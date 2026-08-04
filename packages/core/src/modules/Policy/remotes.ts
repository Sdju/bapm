/**
 * pl-012 project remote selection for policy discovery.
 */

import { execFileSync } from "node:child_process";
import { PolicyError } from "./errors.ts";

export type GitRemoteEntry = {
  name: string;
  url: string;
};

export type SelectProjectRemoteOptions = {
  cwd?: string;
  /** Injected remotes (preferred when provided). */
  remotes?: GitRemoteEntry[];
  /** Injectable list reader (acceptance / tests). */
  listGitRemotes?: (cwd?: string) => GitRemoteEntry[];
};

export type SelectedProjectRemote =
  | (GitRemoteEntry & { remote?: GitRemoteEntry; skipped?: false; absent?: false })
  | { absent: true; skipped: true; remote?: null }
  | null;

/**
 * Prefer `origin`; else single remote; else fail closed naming candidates; else skip.
 */
export function selectProjectRemote(
  options: SelectProjectRemoteOptions = {},
): SelectedProjectRemote {
  const remotes =
    options.remotes ??
    options.listGitRemotes?.(options.cwd) ??
    listGitRemotes(options.cwd);

  if (!remotes.length) {
    return { absent: true, skipped: true, remote: null };
  }

  const origin = remotes.find((r) => r.name === "origin");
  if (origin) {
    return { ...origin, remote: origin };
  }

  if (remotes.length === 1) {
    const only = remotes[0]!;
    return { ...only, remote: only };
  }

  const names = remotes.map((r) => r.name).join(", ");
  throw new PolicyError(
    "POLICY_REMOTE_AMBIGUOUS",
    `Multiple git remotes without origin — ambiguous candidates: ${names}`,
    { details: { candidates: remotes, remotes } },
  );
}

/** Alias names accepted by acceptance helpers. */
export const selectGitRemoteForPolicy = selectProjectRemote;
export const resolveProjectRemote = selectProjectRemote;

/**
 * Production git remote reader (`git remote -v`). Dedupes fetch URLs by name.
 */
export function listGitRemotes(cwd?: string): GitRemoteEntry[] {
  try {
    const out = execFileSync("git", ["remote", "-v"], {
      cwd: cwd ?? process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return parseGitRemoteV(out);
  } catch {
    return [];
  }
}

export function parseGitRemoteV(stdout: string): GitRemoteEntry[] {
  const byName = new Map<string, string>();
  for (const line of stdout.split("\n")) {
    const m = /^(\S+)\s+(\S+)\s+\((fetch|push)\)\s*$/.exec(line.trim());
    if (!m) continue;
    const [, name, url, kind] = m;
    if (kind === "fetch" || !byName.has(name!)) {
      byName.set(name!, url!);
    }
  }
  return [...byName.entries()].map(([name, url]) => ({ name, url }));
}

/** Parse owner/repo from a git remote URL (https or ssh). */
export function parseOwnerRepoFromRemoteUrl(url: string): { owner: string; repo: string; host: string } | null {
  const s = url.trim().replace(/\.git$/i, "");
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
      const u = new URL(s);
      const parts = u.pathname.replace(/^\//, "").split("/").filter(Boolean);
      if (parts.length >= 2) {
        return { host: u.hostname, owner: parts[0]!, repo: parts[1]! };
      }
      return null;
    }
    // git@host:owner/repo
    const scp = /^git@([^:]+):(.+)$/.exec(s);
    if (scp) {
      const host = scp[1]!;
      const parts = scp[2]!.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return { host, owner: parts[0]!, repo: parts[1]! };
      }
    }
    // host:owner/repo
    const bare = /^([^/:]+):([^/]+)\/([^/]+)$/.exec(s);
    if (bare) {
      return { host: bare[1]!, owner: bare[2]!, repo: bare[3]! };
    }
  } catch {
    return null;
  }
  return null;
}
