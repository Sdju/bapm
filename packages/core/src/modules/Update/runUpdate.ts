import { resolve } from "node:path";
import { loadEffectiveLockfileOrNull } from "@/modules/Lockfile";
import { loadManifest } from "@/modules/Manifest";
import {
  createDefaultGitRemote,
  createDefaultTagLister,
  pickHighestSatisfyingTag,
  resolveAndLock,
  type ResolvePorts,
} from "@/modules/Resolver";
import { isCiEnvTruthy, runInstall } from "@/modules/Install";
import { asText } from "@/common/asText.ts";
import { UpdateError } from "./errors.ts";
import type { RunUpdateOptions, UpdatePlanEntry, UpdateResult } from "./types.ts";

/**
 * Plan and optionally apply a full/scoped dependency update.
 */
export async function runUpdate(options: RunUpdateOptions = {}): Promise<UpdateResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const dryRun = options.dryRun === true || options["dry-run"] === true;
  const yes = options.yes === true;
  const frozen = effectiveFrozen(options);
  const override = options.force === true || options.override === true;
  const scope = options.scope ?? options.packages ?? options.updatePackageNames ?? undefined;

  if (frozen && !override) {
    throw new UpdateError(
      "UPDATE_FROZEN_REFUSED",
      "Update refused under frozen context without explicit override",
      { details: { frozen: true } },
    );
  }

  const before = loadEffectiveLockfileOrNull({ cwd });
  const beforePins = pinMap(before?.document?.dependencies);

  const ports: ResolvePorts = {
    gitRemote: options.gitRemote,
    tagLister: options.tagLister,
    downloader: options.downloader,
  };

  const policyPorts = {
    policyProviders: options.policyProviders ?? options.providers,
    providers: options.providers ?? options.policyProviders,
    listGitRemotes: options.listGitRemotes,
    remotes: options.remotes,
    fetchPolicyUrl: options.fetchPolicyUrl,
    httpGet: options.httpGet,
    fetchAncestor: options.fetchAncestor,
    defaultFetchFailure: options.defaultFetchFailure,
    implementationDefaultHost: options.implementationDefaultHost,
  };

  const verbose = options.verbose === true;

  if (dryRun) {
    const plan = await planWithoutMutation(cwd, before?.document?.dependencies, scope, ports);
    const text = formatPlan(plan, { verbose });
    return { ok: true, exitCode: 0, dryRun: true, plan, text };
  }

  if (!yes) {
    const isTTY = options.isTTY ?? Boolean(process.stdin.isTTY);
    if (!isTTY) {
      throw new UpdateError(
        "UPDATE_CONFIRM_REQUIRED",
        "Update requires -y/--yes in non-TTY environments when applying changes",
      );
    }
    const confirmed = options.confirm ? await options.confirm() : false;
    if (!confirmed) {
      return {
        ok: true,
        exitCode: 0,
        dryRun: false,
        plan: [],
        text: "Update cancelled (default No)",
      };
    }
  }

  const resolved = await resolveAndLock({
    cwd,
    updateRefs: true,
    scope,
    updatePackageNames: scope,
    purgeInstallPaths: true,
    parallelDownloads: options.parallelDownloads,
    maxDepth: options.maxDepth,
    policyPath: options.policyPath ?? options.policy,
    policy: options.policy ?? options.policyPath,
    noPolicy: options.noPolicy,
    noRepoPolicy: options.noRepoPolicy,
    ...policyPorts,
    ...ports,
  });

  try {
    await runInstall({
      cwd,
      frozen: false,
      updateRefs: false,
      policyPath: options.policyPath ?? options.policy,
      policy: options.policy ?? options.policyPath,
      noPolicy: options.noPolicy,
      noRepoPolicy: options.noRepoPolicy,
      ...policyPorts,
      ...ports,
    });
  } catch {
    // Install compose may fail without targets registered; lock rewrite already done.
  }

  const after = loadEffectiveLockfileOrNull({ cwd });
  const plan = buildPlan(beforePins, nodesFromLock(after?.document?.dependencies));
  const text = formatPlan(plan, { verbose });

  return {
    ok: true,
    exitCode: 0,
    dryRun: false,
    plan,
    text,
    lockPath: resolved.lockPath,
  };
}

export const updateProject = runUpdate;

/**
 * Effective frozen context:
 * - explicit `frozen: true` / `frozen: false` wins (false is the opt-out);
 * - otherwise a truthy `CI` env (default: process.env) implies frozen.
 */
function effectiveFrozen(options: RunUpdateOptions): boolean {
  if (options.frozen !== undefined) return options.frozen === true;
  const env = options.env ?? (process.env as Record<string, string | undefined>);
  return isCiEnvTruthy(env);
}

async function planWithoutMutation(
  cwd: string,
  deps: Array<Record<string, unknown>> | undefined,
  scope: string[] | undefined,
  ports: ResolvePorts,
): Promise<UpdatePlanEntry[]> {
  try {
    loadManifest({ cwd });
  } catch {
    /* still plan from lock */
  }
  const tagLister = ports.tagLister ?? createDefaultTagLister();
  const gitRemote = ports.gitRemote ?? createDefaultGitRemote();
  const scopeSet = new Set((scope ?? []).map((s) => s.trim()).filter(Boolean));
  const plan: UpdatePlanEntry[] = [];

  for (const d of deps ?? []) {
    const name = asText(d.name ?? d.repo_url ?? "");
    const repo = asText(d.repo_url ?? "");
    if (!name) continue;
    if (scopeSet.size > 0 && ![...scopeSet].some((s) => name.includes(s) || repo.includes(s))) {
      plan.push({
        name,
        action: "keep",
        from: asText(d.resolved_commit ?? ""),
        to: asText(d.resolved_commit ?? ""),
      });
      continue;
    }
    if (!repo || repo.startsWith("local:")) {
      plan.push({ name, action: "keep", from: "local", to: "local" });
      continue;
    }
    const from = asText(d.resolved_commit ?? d.resolved_tag ?? "");
    const gitUrl = repo.includes("://") ? repo : `https://${repo}`;
    const constraint = semverConstraintFor(d);

    if (constraint) {
      try {
        const tags = await tagLister.listTags(gitUrl);
        const picked = pickHighestSatisfyingTag(
          tags.map((t) => t.tag),
          constraint,
        );
        const hit = picked ? tags.find((t) => t.tag === picked) : undefined;
        const to = hit?.commit ?? from;
        plan.push({
          name,
          action: to !== from ? "update" : "keep",
          from,
          to,
        });
      } catch {
        plan.push({ name, action: "keep", from, to: from });
      }
      continue;
    }

    // No semver range: mutable branch/tag pin. Resolve its current tip so the
    // plan matches what apply (`updateRefs: true`) would write.
    const ref = mutableRefFor(d);
    if (!ref || FULL_COMMIT_RE.test(ref)) {
      plan.push({ name, action: "keep", from, to: from });
      continue;
    }
    if (!from) {
      plan.push({
        name,
        action: "keep",
        from,
        to: from,
        note: `lock pin missing; cannot compare ref ${ref}`,
      });
      continue;
    }
    try {
      const tip = (await gitRemote.resolveRef(gitUrl, ref)).trim();
      const changed = Boolean(tip) && tip.toLowerCase() !== from.toLowerCase();
      plan.push({
        name,
        action: changed ? "update" : "keep",
        from,
        to: changed ? tip : from,
      });
    } catch (error) {
      plan.push({
        name,
        action: "keep",
        from,
        to: from,
        note: `unable to resolve ref ${ref}: ${errorMessage(error)}`,
      });
    }
  }

  if (plan.length === 0) {
    plan.push({ name: "(plan)", action: "keep" });
  }
  return plan;
}

const FULL_COMMIT_RE = /^[0-9a-f]{40}$/i;

/**
 * Semver constraint from the lock (`constraint`) or, for older locks, a
 * major range derived from a semver-looking `resolved_tag`.
 */
function semverConstraintFor(d: Record<string, unknown>): string | undefined {
  const declared = typeof d.constraint === "string" ? d.constraint.trim() : "";
  if (declared) return declared;
  const tag = asText(d.resolved_tag ?? "").trim();
  if (!tag) return undefined;
  const version = tag.replace(/^v/i, "");
  if (!/^\d+\.\d+\.\d+/.test(version)) return undefined;
  return `^${version.split(".")[0]}.0.0`;
}

/** Literal ref recorded by the resolver (`resolved_ref`, legacy `resolved_tag`). */
function mutableRefFor(d: Record<string, unknown>): string {
  const resolvedRef = asText(d.resolved_ref ?? "").trim();
  if (resolvedRef) return resolvedRef;
  return asText(d.resolved_tag ?? "").trim();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function pinMap(deps: Array<Record<string, unknown>> | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of deps ?? []) {
    const name = asText(d.name ?? d.repo_url ?? "");
    if (!name) continue;
    const pin = asText(d.resolved_commit ?? d.resolved_tag ?? d.version ?? "");
    map.set(name, pin);
    const repo = asText(d.repo_url ?? "");
    if (repo) map.set(repo, pin);
  }
  return map;
}

function nodesFromLock(
  deps: Array<Record<string, unknown>> | undefined,
): Array<{ name: string; resolved_commit?: string; repo_url?: string }> {
  return (deps ?? []).map((d) => ({
    name: asText(d.name ?? d.repo_url ?? ""),
    resolved_commit: typeof d.resolved_commit === "string" ? d.resolved_commit : undefined,
    repo_url: typeof d.repo_url === "string" ? d.repo_url : undefined,
  }));
}

function buildPlan(
  before: Map<string, string>,
  nodes: Array<{ name: string; resolved_commit?: string; repo_url?: string }>,
): UpdatePlanEntry[] {
  const plan: UpdatePlanEntry[] = [];
  const seen = new Set<string>();
  for (const n of nodes) {
    const key = n.name || n.repo_url || "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const to = n.resolved_commit ?? "";
    const from = before.get(n.name) ?? before.get(n.repo_url ?? "") ?? "";
    if (!from) {
      plan.push({ name: key, action: "add", to });
    } else if (from !== to) {
      plan.push({ name: key, action: "update", from, to });
    } else {
      plan.push({ name: key, action: "keep", from, to });
    }
  }
  return plan;
}

function formatPlan(plan: UpdatePlanEntry[], options: { verbose?: boolean } = {}): string {
  const verbose = options.verbose === true;
  const printable = verbose ? plan : plan.filter((p) => p.action !== "keep");
  if (printable.length === 0) return "No dependency changes planned";
  return printable
    .map((p) => {
      const note = verbose && p.note ? ` — ${p.note}` : "";
      if (p.action === "update") return `[~] ${p.name}: ${p.from} → ${p.to}${note}`;
      if (p.action === "add") return `[+] ${p.name}: ${p.to}${note}`;
      if (p.action === "remove") return `[-] ${p.name}${note}`;
      return `[=] ${p.name} keep${note}`;
    })
    .join("\n");
}
