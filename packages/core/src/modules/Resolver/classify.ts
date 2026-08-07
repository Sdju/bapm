import { ResolverError } from "./errors.ts";
import type { ClassifiedDependency, DependencyKind } from "./types.ts";
import { parseMarketplaceRef } from "@/modules/Marketplace";

/**
 * Classify a dependency declaration (OpenAPM kind precedence:
 * local → registry → git-semver → git-literal; marketplace non-normative).
 */
export function classifyDependencyRef(input: unknown): ClassifiedDependency {
  if (input === null || input === undefined) {
    throw new ResolverError("CLASSIFY_INVALID", "Dependency ref is null/undefined");
  }

  if (typeof input === "string") {
    return classifyString(input);
  }

  if (typeof input === "object" && !Array.isArray(input)) {
    const obj = input as Record<string, unknown>;

    // BapmDependency-like { spec }
    if (typeof obj.spec === "string" && !hasSourceKey(obj)) {
      return classifyString(obj.spec);
    }

    const path = typeof obj.path === "string" ? obj.path : undefined;
    const git = typeof obj.git === "string" ? obj.git : undefined;
    const id = typeof obj.id === "string" ? obj.id : undefined;
    const registry = typeof obj.registry === "string" ? obj.registry : undefined;
    const ref = typeof obj.ref === "string" ? obj.ref : undefined;
    const alias = typeof obj.alias === "string" ? obj.alias : undefined;
    const prerelease = obj.prerelease === true;

    // local: path without git / id (path may accompany git as virtual_path — then git wins)
    if (path !== undefined && git === undefined && id === undefined && registry === undefined) {
      return {
        kind: "local",
        raw: input,
        path,
        alias,
      };
    }

    // registry: id: (and optional registry coordinates)
    if (id !== undefined || (registry !== undefined && git === undefined && path === undefined)) {
      return {
        kind: "registry",
        raw: input,
        id,
        registry,
        alias,
        path,
      };
    }

    if (git !== undefined) {
      const gitKind = classifyGitRef(ref);
      return {
        kind: gitKind,
        raw: input,
        git,
        ref,
        path,
        alias,
        prerelease,
      };
    }

    // Object marketplace form: { name, marketplace, version? }
    if (typeof obj.marketplace === "string") {
      const pluginName = typeof obj.name === "string" ? obj.name : undefined;
      const versionSpec =
        typeof obj.version === "string"
          ? obj.version
          : typeof obj.ref === "string"
            ? obj.ref
            : undefined;
      return {
        kind: "marketplace",
        raw: input,
        alias,
        pluginName,
        marketplaceName: obj.marketplace,
        versionSpec,
      };
    }
  }

  throw new ResolverError(
    "CLASSIFY_INVALID",
    `Cannot classify dependency ref: ${summarize(input)}`,
  );
}

function hasSourceKey(obj: Record<string, unknown>): boolean {
  return "git" in obj || "id" in obj || "path" in obj || "registry" in obj;
}

function classifyString(spec: string): ClassifiedDependency {
  const trimmed = spec.trim();

  // Local path forms: explicit POSIX/Windows relative, absolute, home, or path: prefix.
  if (
    trimmed.startsWith("path:") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("~/") ||
    trimmed.startsWith(".\\") ||
    trimmed.startsWith("..\\") ||
    trimmed.startsWith("~\\") ||
    /^[A-Za-z]:[\\/]/.test(trimmed)
  ) {
    const path = trimmed.startsWith("path:") ? trimmed.slice("path:".length).trim() : trimmed;
    return { kind: "local", raw: spec, path };
  }

  // Marketplace NAME@MARKETPLACE[#ref] before owner/repo / @-bearing fallbacks
  try {
    const mp = parseMarketplaceRef(trimmed);
    if (mp) {
      return {
        kind: "marketplace",
        raw: spec,
        pluginName: mp.pluginName,
        marketplaceName: mp.marketplaceName,
        versionSpec: mp.ref ?? undefined,
      };
    }
  } catch (cause) {
    // Semver-range reject must surface (G1)
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new ResolverError("CLASSIFY_INVALID", message, { cause });
  }

  // registry:id or bare id-like with registry scheme
  if (trimmed.startsWith("registry:") || /^[a-z0-9.-]+\/[a-z0-9._-]+$/i.test(trimmed) === false) {
    // continue to git forms
  }

  // Shorthand org/repo#ref or host/org/repo#ref
  const hashIdx = trimmed.indexOf("#");
  if (hashIdx > 0) {
    const repo = trimmed.slice(0, hashIdx);
    const ref = trimmed.slice(hashIdx + 1);
    if (looksLikeRepo(repo)) {
      const gitKind = classifyGitRef(ref || undefined);
      return {
        kind: gitKind,
        raw: spec,
        git: normalizeGitUrlHint(repo),
        ref: ref || undefined,
      };
    }
  }

  if (looksLikeRepo(trimmed)) {
    return {
      kind: "git-literal",
      raw: spec,
      git: normalizeGitUrlHint(trimmed),
    };
  }

  // Fallback: treat as local relative path (APM sometimes allows bare paths)
  if (!trimmed.includes("://") && !trimmed.includes("@")) {
    return { kind: "local", raw: spec, path: trimmed };
  }

  throw new ResolverError("CLASSIFY_INVALID", `Cannot classify dependency string: ${trimmed}`);
}

/**
 * Classify git `ref:` as semver range, literal, or none→literal default (rs-003).
 */
export function classifyGitRef(ref: string | undefined): "git-semver" | "git-literal" {
  if (ref === undefined || ref === "") {
    return "git-literal";
  }
  if (isSemverRangeToken(ref)) {
    return "git-semver";
  }
  return "git-literal";
}

/**
 * Heuristic: node-semver range tokens / operators vs literal branch/tag/commit.
 */
export function isSemverRangeToken(ref: string): boolean {
  const t = ref.trim();
  // Exact 40-hex commit
  if (/^[0-9a-f]{40}$/i.test(t)) return false;
  // Semver range operators / wildcards
  if (/[\^~*xX]|>=|<=|<|>|\|\||,/.test(t)) return true;
  // Plain semver version used as exact range (e.g. "1.2.3") — treat as semver pin range
  if (/^v?\d+\.\d+\.\d+/.test(t) && /[\^~*>=<|]/.test(t) === false) {
    // Exact version like 1.2.3 is a valid node-semver range; OpenAPM treats as git-semver
    // when it looks like a version. Branch names like "main" fail this.
    if (/^v?\d+\.\d+\.\d+([-+].*)?$/.test(t)) return true;
  }
  // Ranges like "1.x" or "1.2"
  if (/^\d+(\.x|\.\d+)?$/i.test(t)) return true;
  return false;
}

function looksLikeRepo(s: string): boolean {
  if (s.includes("://") || s.startsWith("git@")) return true;
  // host/owner/repo or owner/repo
  const parts = s.replace(/\.git$/, "").split("/");
  return parts.length >= 2 && parts.every((p) => p.length > 0);
}

function normalizeGitUrlHint(repo: string): string {
  if (repo.includes("://") || repo.startsWith("git@")) return repo;
  if (repo.startsWith("github.com/") || /^[^/]+\.[^/]+\//.test(repo)) {
    return `https://${repo}`;
  }
  return `https://github.com/${repo}`;
}

function summarize(input: unknown): string {
  try {
    return JSON.stringify(input).slice(0, 120);
  } catch {
    return String(input);
  }
}

export type { DependencyKind };
