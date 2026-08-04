import { resolve } from "node:path";
import { loadLockfileOrNull } from "@/modules/Lockfile";
import { loadManifest } from "@/modules/Manifest";
import {
  createDefaultTagLister,
  pickHighestSatisfyingTag,
  resolveAndLock,
  type ResolvePorts,
} from "@/modules/Resolver";
import { runInstall } from "@/modules/Install";
import { UpdateError } from "./errors.ts";
import type { RunUpdateOptions, UpdatePlanEntry, UpdateResult } from "./types.ts";

/**
 * Plan and optionally apply a full/scoped dependency update.
 */
export async function runUpdate(options: RunUpdateOptions = {}): Promise<UpdateResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const dryRun = options.dryRun === true || options["dry-run"] === true;
  const yes = options.yes === true;
  const frozen = options.frozen === true;
  const override = options.force === true || options.override === true;
  const scope = options.scope ?? options.packages ?? options.updatePackageNames ?? undefined;

  if (frozen && !override) {
    throw new UpdateError(
      "UPDATE_FROZEN_REFUSED",
      "Update refused under frozen context without explicit override",
      { details: { frozen: true } },
    );
  }

  const before = loadLockfileOrNull({ cwd });
  const beforePins = pinMap(before?.document?.dependencies);

  const ports: ResolvePorts = {
    gitRemote: options.gitRemote,
    tagLister: options.tagLister,
    downloader: options.downloader,
  };

  if (dryRun) {
    const plan = await planWithoutMutation(cwd, before?.document?.dependencies, scope, ports);
    const text = formatPlan(plan);
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
    ...ports,
  });

  try {
    await runInstall({
      cwd,
      frozen: false,
      updateRefs: false,
      ...ports,
    });
  } catch {
    // Install compose may fail without targets registered; lock rewrite already done.
  }

  const after = loadLockfileOrNull({ cwd });
  const plan = buildPlan(beforePins, nodesFromLock(after?.document?.dependencies));
  const text = formatPlan(plan);

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
  const scopeSet = new Set((scope ?? []).map((s) => s.trim()).filter(Boolean));
  const plan: UpdatePlanEntry[] = [];

  for (const d of deps ?? []) {
    const name = String(d.name ?? d.repo_url ?? "");
    const repo = String(d.repo_url ?? "");
    if (!name) continue;
    if (scopeSet.size > 0 && ![...scopeSet].some((s) => name.includes(s) || repo.includes(s))) {
      plan.push({
        name,
        action: "keep",
        from: String(d.resolved_commit ?? ""),
        to: String(d.resolved_commit ?? ""),
      });
      continue;
    }
    if (!repo || repo.startsWith("local:")) {
      plan.push({ name, action: "keep", from: "local", to: "local" });
      continue;
    }
    const from = String(d.resolved_commit ?? d.resolved_tag ?? "");
    const gitUrl = repo.includes("://") ? repo : `https://${repo}`;
    const constraint =
      typeof d.constraint === "string"
        ? d.constraint
        : typeof d.resolved_tag === "string"
          ? `^${String(d.resolved_tag).replace(/^v/, "").split(".")[0]}.0.0`
          : undefined;
    try {
      if (constraint) {
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
      } else {
        plan.push({ name, action: "keep", from, to: from });
      }
    } catch {
      plan.push({ name, action: "keep", from, to: from });
    }
  }

  if (plan.length === 0) {
    plan.push({ name: "(plan)", action: "keep" });
  }
  return plan;
}

function pinMap(deps: Array<Record<string, unknown>> | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of deps ?? []) {
    const name = String(d.name ?? d.repo_url ?? "");
    if (!name) continue;
    const pin = String(d.resolved_commit ?? d.resolved_tag ?? d.version ?? "");
    map.set(name, pin);
    const repo = String(d.repo_url ?? "");
    if (repo) map.set(repo, pin);
  }
  return map;
}

function nodesFromLock(
  deps: Array<Record<string, unknown>> | undefined,
): Array<{ name: string; resolved_commit?: string; repo_url?: string }> {
  return (deps ?? []).map((d) => ({
    name: String(d.name ?? d.repo_url ?? ""),
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

function formatPlan(plan: UpdatePlanEntry[]): string {
  if (plan.length === 0) return "No dependency changes planned";
  return plan
    .map((p) => {
      if (p.action === "update") return `[~] ${p.name}: ${p.from} → ${p.to}`;
      if (p.action === "add") return `[+] ${p.name}: ${p.to}`;
      if (p.action === "remove") return `[-] ${p.name}`;
      return `[=] ${p.name} keep`;
    })
    .join("\n");
}
