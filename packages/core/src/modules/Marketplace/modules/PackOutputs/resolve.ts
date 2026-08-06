import { spawn } from "node:child_process";
import { resolve } from "node:path";
import {
  githubHttpsUrlFromOwnerRepo,
  isGithubOwnerRepoShorthand,
  isLocalAuthoringSource,
  splitHostFromAuthoringSource,
} from "../Authoring/source.ts";
import { loadMarketplaceAuthoringConfig } from "../Authoring/detect.ts";
import { loadMarketplaceFromBapmYml } from "../Authoring/load.ts";
import type { MarketplaceAuthoringConfig, PackageEntry } from "../Authoring/types.ts";
import { MarketplacePackOutputsError } from "./errors.ts";
import type {
  LsRemoteFn,
  LsRemoteResult,
  ResolveMarketplacePackagesOptions,
  ResolveMarketplacePackagesResult,
  ResolvedPackage,
} from "./types.ts";

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

function parseSemverFromTag(tag: string): { major: number; minor: number; patch: number; prerelease: string } | null {
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
  if (/^(v)?\d+\.\d+\.\d+/.test(r) && !r.startsWith("^") && !r.startsWith("~") && !r.startsWith(">=")) {
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

async function defaultLsRemote(repoUrl: string, ref?: string): Promise<LsRemoteResult> {
  const args = ref ? ["ls-remote", repoUrl, ref] : ["ls-remote", repoUrl, "HEAD"];
  return new Promise((resolvePromise, reject) => {
    const child = spawn("git", args, { stdio: ["ignore", "pipe", "pipe"] });
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
      const line = stdout.trim().split("\n")[0]!;
      const [sha, name] = line.split("\t");
      if (!sha || sha.length < 7) {
        reject(new Error(`git ls-remote returned no sha for ${repoUrl}`));
        return;
      }
      let resolvedRef = ref ?? "HEAD";
      if (name) {
        resolvedRef = name.replace(/^refs\/(?:heads|tags)\//, "").replace(/\^\{\}$/, "");
      }
      resolvePromise({ sha: sha.trim(), ref: resolvedRef });
    });
  });
}

async function listRemoteTags(lsRemote: LsRemoteFn, repoUrl: string): Promise<Map<string, string>> {
  // Request all refs; injectable may only support single-ref — fall back empty.
  try {
    const result = await lsRemote(repoUrl, "refs/tags/*");
    // Single-result injectables return one; still usable as one tag.
    return new Map([[result.ref.replace(/^refs\/tags\//, ""), result.sha]]);
  } catch {
    // Try bare ls-remote HEAD listing is not enough; spawn full tags list via default when injectable fails pattern
  }

  return new Promise((resolvePromise, reject) => {
    const child = spawn("git", ["ls-remote", "--tags", repoUrl], {
      stdio: ["ignore", "pipe", "pipe"],
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
      for (const line of stdout.split("\n")) {
        const [sha, name] = line.trim().split("\t");
        if (!sha || !name) continue;
        if (name.endsWith("^{}")) continue;
        const tag = name.replace(/^refs\/tags\//, "");
        map.set(tag, sha.trim());
      }
      resolvePromise(map);
    });
  });
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
  },
): Promise<ResolvedPackage> {
  if (options.offline) {
    throw new MarketplacePackOutputsError(
      `Package '${pkg.name}' source '${pkg.source}': offline resolve needs network (ref/sha via ls-remote); cannot resolve remote without network`,
    );
  }

  if (!isGithubOwnerRepoShorthand(pkg.source)) {
    const { host } = splitHostFromAuthoringSource(pkg.source);
    if (host && host !== "github.com" && !host.endsWith(".ghe.com")) {
      throw new MarketplacePackOutputsError(
        `Package '${pkg.name}' source '${pkg.source}': remote host '${host}' is unsupported for pack emit without hosts-auth (gitlab / non-github remotes not supported)`,
      );
    }
    if (host === "github.com" || host?.endsWith(".ghe.com")) {
      // Allowed github FQDN form — resolve via https URL
    } else if (!isGithubOwnerRepoShorthand(pkg.source)) {
      throw new MarketplacePackOutputsError(
        `Package '${pkg.name}' source '${pkg.source}': unsupported remote for pack emit (auth / host not supported)`,
      );
    }
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
      sha: remote.sha,
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
    const tags = await listRemoteTags(options.lsRemote, repoUrl);
    const re = globToRegExp(tagPattern);
    const candidates: { tag: string; sha: string; semver: NonNullable<ReturnType<typeof parseSemverFromTag>> }[] =
      [];
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
      sha: best.sha,
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
    sha: remote.sha,
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
      await resolveRemotePackage(pkg, config, { offline, includePrerelease, lsRemote }),
    );
  }

  return { packages: resolved, resolved };
}

/** Alias for acceptance soft-resolve. */
export const resolveAuthoringPackages = resolveMarketplacePackages;
export const resolveMarketplacePackPackages = resolveMarketplacePackages;
