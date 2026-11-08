import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { parseLsRemoteTagsWithPeel } from "@/common/gitLsRemoteTags.ts";
import { buildGitChildEnv, hostnameFromUrlOrHost } from "@/modules/Auth";
import { classifyMarketplaceHost } from "../../hostClassify.ts";
import {
  githubHttpsUrlFromOwnerRepo,
  isGithubOwnerRepoShorthand,
  isLocalAuthoringSource,
  loadMarketplaceAuthoringConfig,
  loadMarketplaceFromBapmYml,
  splitHostFromAuthoringSource,
  type MarketplaceAuthoringConfig,
  type PackageEntry,
} from "../../authoring.ts";
import { MarketplacePackOutputsError } from "./errors.ts";
import type {
  LsRemoteFn,
  LsRemoteResult,
  ResolveMarketplacePackagesOptions,
  ResolveMarketplacePackagesResult,
  ResolvedPackage,
} from "./types.ts";

function gitEnvForUrl(repoUrl: string): NodeJS.ProcessEnv {
  const host = hostnameFromUrlOrHost(repoUrl) ?? "localhost";
  return buildGitChildEnv({ host, url: repoUrl, env: process.env });
}

function globToRegExp(pattern: string): RegExp {
  // Simple glob: * → [^/]*, ? → [^/], escape rest. Anchored full match.
  let out = "^";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === "*") out += "[^/]*";
    else if (c === "?") out += "[^/]";
    else if ("\\.[]{}()+-^$|".includes(c)) out += `\\${c}`;
    else out += c;
  }
  out += "$";
  return new RegExp(out);
}

function parseSemverFromTag(
  tag: string,
): { major: number; minor: number; patch: number; prerelease: string } | null {
  const t = tag.replace(/^v/i, "");
  const m = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/.exec(t);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ?? "",
  };
}

function compareSemver(
  a: { major: number; minor: number; patch: number; prerelease: string },
  b: { major: number; minor: number; patch: number; prerelease: string },
): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (!a.prerelease && b.prerelease) return 1;
  if (a.prerelease && !b.prerelease) return -1;
  return a.prerelease.localeCompare(b.prerelease);
}

function satisfiesSimpleRange(version: string, range: string): boolean {
  const v = parseSemverFromTag(version);
  if (!v) return false;
  const r = range.trim();
  // Exact
  if (
    /^(v)?\d+\.\d+\.\d+/.test(r) &&
    !r.startsWith("^") &&
    !r.startsWith("~") &&
    !r.startsWith(">=")
  ) {
    const exact = parseSemverFromTag(r.replace(/^v/, ""));
    return exact !== null && compareSemver(v, exact) === 0 && !v.prerelease;
  }
  if (r.startsWith("^")) {
    const base = parseSemverFromTag(r.slice(1));
    if (!base) return false;
    if (v.major !== base.major) return false;
    return compareSemver(v, base) >= 0;
  }
  if (r.startsWith("~")) {
    const base = parseSemverFromTag(r.slice(1));
    if (!base) return false;
    return v.major === base.major && v.minor === base.minor && compareSemver(v, base) >= 0;
  }
  if (r.startsWith(">=")) {
    const base = parseSemverFromTag(r.slice(2).trim());
    if (!base) return false;
    return compareSemver(v, base) >= 0;
  }
  // Fallback: treat as exact tag name match candidate handled elsewhere
  return version === r || version === `v${r}` || `v${version}` === r;
}

const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/i;

function normalizeTagRef(ref: string): string {
  return ref.replace(/^refs\/tags\//, "").replace(/\^\{\}$/, "");
}

/** Explicit peel pattern: `git ls-remote <repo> <tag>` alone never prints `^{}`. */
function tagPeelPattern(ref: string): string {
  return `refs/tags/${normalizeTagRef(ref)}^{}`;
}

type LsRemoteLine = { sha: string; name: string };

function parseLsRemoteLines(output: string): LsRemoteLine[] {
  const entries: LsRemoteLine[] = [];
  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [sha, name] = trimmed.split(/\s+/);
    if (!sha || !name || !FULL_COMMIT_SHA.test(sha)) continue;
    entries.push({ sha: sha.toLowerCase(), name });
  }
  return entries;
}

/**
 * Peel-aware single-ref ls-remote.
 * Annotated/signed tags emit the tag object plus a peeled `^{}` commit; the
 * peeled commit is the APM marketplace `source.sha` fence.
 */
export async function defaultLsRemote(repoUrl: string, ref?: string): Promise<LsRemoteResult> {
  const args = ref
    ? ["ls-remote", repoUrl, ref, tagPeelPattern(ref)]
    : ["ls-remote", repoUrl, "HEAD"];
  const env = gitEnvForUrl(repoUrl);
  return new Promise((resolvePromise, reject) => {
    const child = spawn("git", args, { stdio: ["ignore", "pipe", "pipe"], env });
    let stderr = "";
    let stdout = "";
    child.stdout?.on("data", (c: Buffer) => {
      stdout += c.toString();
    });
    child.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0 || !stdout.trim()) {
        reject(
          new Error(
            `git ls-remote failed / unreachable / not found for ${repoUrl}: ${stderr.trim() || `exit ${code}`}`,
          ),
        );
        return;
      }
      const entries = parseLsRemoteLines(stdout);
      if (entries.length === 0) {
        reject(new Error(`git ls-remote returned no full commit sha for ${repoUrl}`));
        return;
      }
      // Prefer the peeled tag commit over the annotated tag object. Only trust a
      // peel for an actual tag ref: a branch named like a tag must stay a branch.
      const first = entries[0]!;
      const chosen = first.name.startsWith("refs/tags/")
        ? (entries.find((entry) => entry.name === `${first.name}^{}`) ?? first)
        : first;
      const resolvedRef = chosen.name.replace(/^refs\/(?:heads|tags)\//, "").replace(/\^\{\}$/, "");
      resolvePromise({ sha: chosen.sha, ref: resolvedRef });
    });
  });
}

/**
 * List remote tags with annotated/signed tags peeled to their commit.
 *
 * A single-ref injectable (tests) may only return one tag; otherwise run
 * `git ls-remote --tags` without `--refs` so `refs/tags/X^{}` evidence is kept.
 */
export async function listRemoteTags(
  repoUrl: string,
  injectableLsRemote?: LsRemoteFn,
): Promise<Map<string, string>> {
  if (injectableLsRemote) {
    try {
      const result = await injectableLsRemote(repoUrl, "refs/tags/*");
      // Single-result injectables return one; still usable as one tag.
      return new Map([[normalizeTagRef(result.ref), result.sha]]);
    } catch {
      // Injectable cannot list all tags; use the real peel-aware listing below.
    }
  }

  return new Promise((resolvePromise, reject) => {
    const child = spawn("git", ["ls-remote", "--tags", repoUrl], {
      stdio: ["ignore", "pipe", "pipe"],
      env: gitEnvForUrl(repoUrl),
    });
    let stderr = "";
    let stdout = "";
    child.stdout?.on("data", (c: Buffer) => {
      stdout += c.toString();
    });
    child.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `git ls-remote --tags failed for ${repoUrl}: ${stderr.trim() || `exit ${code}`}`,
          ),
        );
        return;
      }
      const map = new Map<string, string>();
      for (const { tag, commit } of parseLsRemoteTagsWithPeel(stdout)) {
        map.set(tag, commit);
      }
      resolvePromise(map);
    });
  });
}

function assertFullCommitSha(pkg: PackageEntry, sha: string): string {
  if (!FULL_COMMIT_SHA.test(sha)) {
    throw new MarketplacePackOutputsError(
      `Package '${pkg.name}': abbreviated SHA '${sha}' is not allowed; use a full 40-character commit SHA`,
    );
  }
  return sha.toLowerCase();
}

function loadConfig(options: ResolveMarketplacePackagesOptions): MarketplaceAuthoringConfig {
  if (options.config) return options.config;
  if (options.path) {
    return loadMarketplaceFromBapmYml({ cwd: options.cwd, path: options.path }).config;
  }
  return loadMarketplaceAuthoringConfig({ cwd: options.cwd }).config;
}

async function resolveRemotePackage(
  pkg: PackageEntry,
  config: MarketplaceAuthoringConfig,
  options: {
    offline: boolean;
    includePrerelease: boolean;
    lsRemote: LsRemoteFn;
    /** Raw injectable (tests); undefined means default peel-aware tag listing. */
    tagListLsRemote?: LsRemoteFn;
  },
): Promise<ResolvedPackage> {
  if (options.offline) {
    throw new MarketplacePackOutputsError(
      `Package '${pkg.name}' source '${pkg.source}': offline resolve needs network (ref/sha via ls-remote); cannot resolve remote without network`,
    );
  }

  let repoUrl: string;
  let sourceRepo: string;
  let host: string | undefined;
  let sourceUrl: string | undefined;

  if (isGithubOwnerRepoShorthand(pkg.source)) {
    sourceRepo = pkg.source.replace(/\.git$/, "");
    repoUrl = githubHttpsUrlFromOwnerRepo(pkg.source);
  } else {
    const split = splitHostFromAuthoringSource(pkg.source);
    host = split.host ?? undefined;
    if (!host) {
      throw new MarketplacePackOutputsError(
        `Package '${pkg.name}' source '${pkg.source}': unsupported remote for pack emit (auth / host not supported)`,
      );
    }
    try {
      const cls = classifyMarketplaceHost(host);
      if (cls === "generic") {
        throw new MarketplacePackOutputsError(
          `Package '${pkg.name}' source '${pkg.source}': remote host '${host}' is unsupported for pack emit ` +
            `(generic git kind still refused / out of scope)`,
        );
      }
    } catch (err) {
      if (err instanceof MarketplacePackOutputsError) throw err;
      throw new MarketplacePackOutputsError(
        `Package '${pkg.name}' source '${pkg.source}': ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    sourceRepo = split.repoPath.replace(/\.git$/, "");
    repoUrl = `https://${host}/${sourceRepo}.git`;
    sourceUrl = `https://${host}/${sourceRepo}`;
  }

  const tagPattern = pkg.tag_pattern ?? config.build?.tagPattern ?? "v*";
  const effectiveTagPattern = tagPattern;

  if (pkg.ref) {
    const remote = await options.lsRemote(repoUrl, pkg.ref);
    return {
      name: pkg.name,
      sourceRepo,
      source: pkg.source,
      subdir: pkg.subdir,
      ref: remote.ref || pkg.ref,
      sha: assertFullCommitSha(pkg, remote.sha),
      requestedVersion: pkg.version,
      tags: pkg.tags ?? [],
      isLocal: false,
      isPrerelease: Boolean(parseSemverFromTag(remote.ref)?.prerelease),
      host,
      sourceUrl,
      effectiveTagPattern,
      category: pkg.category,
      entry: pkg,
    };
  }

  if (pkg.version) {
    const tags = await listRemoteTags(repoUrl, options.tagListLsRemote);
    const re = globToRegExp(tagPattern);
    const candidates: {
      tag: string;
      sha: string;
      semver: NonNullable<ReturnType<typeof parseSemverFromTag>>;
    }[] = [];
    for (const [tag, sha] of tags) {
      if (!re.test(tag)) continue;
      const semver = parseSemverFromTag(tag);
      if (!semver) continue;
      if (semver.prerelease && !options.includePrerelease && !pkg.include_prerelease) continue;
      if (!satisfiesSimpleRange(tag, pkg.version)) continue;
      candidates.push({ tag, sha, semver });
    }
    if (candidates.length === 0) {
      throw new MarketplacePackOutputsError(
        `Package '${pkg.name}': no matching version for range '${pkg.version}' with tag pattern '${tagPattern}' (resolve failed)`,
      );
    }
    candidates.sort((a, b) => compareSemver(a.semver, b.semver));
    const best = candidates[candidates.length - 1]!;
    return {
      name: pkg.name,
      sourceRepo,
      source: pkg.source,
      subdir: pkg.subdir,
      ref: best.tag,
      sha: assertFullCommitSha(pkg, best.sha),
      requestedVersion: pkg.version,
      tags: pkg.tags ?? [],
      isLocal: false,
      isPrerelease: Boolean(best.semver.prerelease),
      host,
      sourceUrl,
      effectiveTagPattern,
      category: pkg.category,
      entry: pkg,
    };
  }

  // Default: resolve HEAD / main
  const remote = await options.lsRemote(repoUrl);
  return {
    name: pkg.name,
    sourceRepo,
    source: pkg.source,
    subdir: pkg.subdir,
    ref: remote.ref,
    sha: assertFullCommitSha(pkg, remote.sha),
    requestedVersion: undefined,
    tags: pkg.tags ?? [],
    isLocal: false,
    isPrerelease: false,
    host,
    sourceUrl,
    effectiveTagPattern,
    category: pkg.category,
    entry: pkg,
  };
}

/**
 * Resolve authoring packages → ResolvedPackage[] (local pass-through; github via ls-remote).
 */
export async function resolveMarketplacePackages(
  options: ResolveMarketplacePackagesOptions = {},
): Promise<ResolveMarketplacePackagesResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const config = loadConfig({ ...options, cwd });
  const offline = Boolean(options.offline);
  const includePrerelease = Boolean(options.includePrerelease);
  const lsRemote = options.lsRemote ?? defaultLsRemote;

  if (!config.packages.length) {
    throw new MarketplacePackOutputsError(
      "Marketplace authoring has no packages configured; refusing to emit empty plugins list",
    );
  }

  const resolved: ResolvedPackage[] = [];
  for (const pkg of config.packages) {
    if (isLocalAuthoringSource(pkg.source) || pkg.isLocal) {
      resolved.push({
        name: pkg.name,
        sourceRepo: pkg.source,
        source: pkg.source,
        subdir: pkg.subdir,
        tags: pkg.tags ?? [],
        isLocal: true,
        isPrerelease: false,
        category: pkg.category,
        entry: pkg,
      });
      continue;
    }
    resolved.push(
      await resolveRemotePackage(pkg, config, {
        offline,
        includePrerelease,
        lsRemote,
        tagListLsRemote: options.lsRemote,
      }),
    );
  }

  return { packages: resolved, resolved };
}

/** Alias for acceptance soft-resolve. */
export const resolveAuthoringPackages = resolveMarketplacePackages;
export const resolveMarketplacePackPackages = resolveMarketplacePackages;
