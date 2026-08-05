import { resolve } from "node:path";
import type { LockedDependency } from "@/modules/Lockfile";
import { loadLockfileOrNull } from "@/modules/Lockfile";
import { loadManifest } from "@/modules/Manifest";
import type { DependencyEntry } from "@/modules/Manifest";
import {
  createDefaultGitRemote,
  createDefaultTagLister,
  isSemverRangeToken,
  normalizeRepoIdentity,
  pickHighestSatisfyingTag,
  toLockRepoUrl,
} from "@/modules/Resolver";
import { OutdatedError } from "./errors.ts";
import type { OutdatedResult, OutdatedRow, RunOutdatedOptions } from "./types.ts";

/**
 * Compare lock pins to remote tips / latest matching semver tags.
 * Exit 0 even when outdated rows exist; no lock → throw / non-success.
 * Read-only: never writes project artifacts.
 */
export async function runOutdated(options: RunOutdatedOptions = {}): Promise<OutdatedResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const loaded = loadLockfileOrNull({ cwd });
  if (!loaded) {
    throw new OutdatedError(
      "OUTDATED_NO_LOCK",
      "No lockfile found; cannot check outdated packages",
    );
  }

  const manifestPins = loadManifestPinRefs(cwd);
  const tagLister = options.tagLister ?? createDefaultTagLister();
  const gitRemote = options.gitRemote ?? createDefaultGitRemote();
  const verbose = options.verbose === true;
  const rows: OutdatedRow[] = [];

  for (const dep of loaded.document.dependencies ?? []) {
    const name = String(dep.name ?? dep.repo_url ?? "unknown");
    const repo = String(dep.repo_url ?? "");
    const current =
      typeof dep.resolved_commit === "string"
        ? dep.resolved_commit
        : typeof dep.resolved_tag === "string"
          ? dep.resolved_tag
          : typeof dep.version === "string"
            ? dep.version
            : "";

    if (!repo || repo.startsWith("local:")) {
      rows.push({
        name,
        status: "up-to-date",
        current: current || "local",
        latest: current || "local",
        repo_url: repo,
        detail: verbose ? "skip: local (no network)" : undefined,
      });
      continue;
    }

    const gitUrl = repo.includes("://") ? repo : `https://${repo}`;
    const constraint = typeof dep.constraint === "string" ? dep.constraint : undefined;

    try {
      if (constraint) {
        const tags = await tagLister.listTags(gitUrl);
        const picked = pickHighestSatisfyingTag(
          tags.map((t) => t.tag),
          constraint,
        );
        if (!picked) {
          rows.push({
            name,
            status: "unknown",
            current,
            repo_url: repo,
            detail: verbose ? `constraint=${constraint}; no satisfying tag` : undefined,
          });
          continue;
        }
        const hit = tags.find((t) => t.tag === picked)!;
        const latestCommit = hit.commit;
        const latestTag = picked;
        const isOutdated =
          (current && latestCommit && current !== latestCommit) ||
          (typeof dep.resolved_tag === "string" && dep.resolved_tag !== latestTag);
        rows.push({
          name,
          status: isOutdated ? "outdated" : "up-to-date",
          current: typeof dep.resolved_tag === "string" ? dep.resolved_tag : current,
          latest: latestTag,
          repo_url: repo,
          tip_ref: latestTag,
          detail: verbose
            ? `constraint=${constraint}; candidates=${tags.map((t) => t.tag).join(",")}`
            : undefined,
        });
      } else {
        const tipRef = resolveTipRef(dep, manifestPins);
        const tip = await gitRemote.resolveRef(gitUrl, tipRef);
        const isOutdated = Boolean(current && tip && current !== tip);
        rows.push({
          name,
          status: isOutdated ? "outdated" : "up-to-date",
          current,
          latest: tip,
          repo_url: repo,
          tip_ref: tipRef,
          detail: verbose ? `tip_ref=${tipRef}` : undefined,
        });
      }
    } catch {
      rows.push({ name, status: "unknown", current, repo_url: repo });
    }
  }

  const hasOutdated = rows.some((r) => r.status === "outdated");
  const text = hasOutdated
    ? formatRows(rows, verbose)
    : rows.every((r) => r.status === "up-to-date")
      ? verbose
        ? `All dependencies are up-to-date\n${formatVerboseExtras(rows)}`
        : "All dependencies are up-to-date"
      : formatRows(rows, verbose);

  return { ok: true, exitCode: 0, rows, text, message: text };
}

export const checkOutdated = runOutdated;
export const outdated = runOutdated;

/**
 * Tip identity: lock `resolved_ref` → literal manifest pin → `HEAD`.
 * Semver-range manifest pins are not used as tip refs.
 */
function resolveTipRef(dep: LockedDependency, manifestPins: Map<string, string>): string {
  if (typeof dep.resolved_ref === "string" && dep.resolved_ref.trim()) {
    return dep.resolved_ref.trim();
  }
  const identity = lockIdentity(dep);
  if (identity) {
    const pin = manifestPins.get(identity);
    if (pin && !isSemverRangeToken(pin)) return pin;
  }
  return "HEAD";
}

function lockIdentity(dep: LockedDependency): string | undefined {
  const repo = String(dep.repo_url ?? "");
  if (!repo || repo.startsWith("local:")) return undefined;
  return normalizeRepoIdentity(repo.includes("://") ? repo : `https://${repo}`);
}

function loadManifestPinRefs(cwd: string): Map<string, string> {
  const map = new Map<string, string>();
  try {
    const { document } = loadManifest({ cwd });
    for (const entry of listApmDeps(document.dependencies)) {
      const pin = pinRefFromEntry(entry);
      if (pin) map.set(pin.identity, pin.ref);
    }
  } catch {
    /* optional for lock-only / local-only */
  }
  return map;
}

function listApmDeps(
  deps: { apm?: DependencyEntry[]; [k: string]: unknown } | undefined,
): DependencyEntry[] {
  if (!deps || !Array.isArray(deps.apm)) return [];
  return deps.apm;
}

function pinRefFromEntry(entry: DependencyEntry): { identity: string; ref: string } | undefined {
  if (typeof entry === "string") {
    const hashIdx = entry.indexOf("#");
    if (hashIdx > 0) {
      const repo = entry.slice(0, hashIdx);
      const ref = entry.slice(hashIdx + 1);
      if (repo && ref) {
        return { identity: toLockRepoUrl(repo), ref };
      }
    }
    return undefined;
  }
  if (!entry || typeof entry !== "object") return undefined;
  const obj = entry as Record<string, unknown>;
  if (typeof obj.spec === "string" && !("git" in obj) && !("path" in obj)) {
    return pinRefFromEntry(obj.spec);
  }
  const git = typeof obj.git === "string" ? obj.git : undefined;
  if (!git) return undefined;
  const ref = typeof obj.ref === "string" && obj.ref.trim() ? obj.ref.trim() : "HEAD";
  return { identity: toLockRepoUrl(git), ref };
}

function formatRows(rows: OutdatedRow[], verbose: boolean): string {
  const lines = rows.map(
    (r) => `${r.name}\t${r.status}\tcurrent=${r.current ?? "-"}\tlatest=${r.latest ?? "-"}`,
  );
  if (verbose) {
    const extras = formatVerboseExtras(rows);
    if (extras) lines.push(extras);
  }
  return lines.join("\n");
}

function formatVerboseExtras(rows: OutdatedRow[]): string {
  return rows
    .filter((r) => r.detail || r.tip_ref)
    .map((r) => {
      const parts = [`# ${r.name}`];
      if (r.tip_ref) parts.push(`tip_ref=${r.tip_ref}`);
      if (r.detail) parts.push(r.detail);
      return parts.join(" ");
    })
    .join("\n");
}
