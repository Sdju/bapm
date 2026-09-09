/**
 * Identity-aware structured merge for `dependencies.apm` entries (req-mf-024).
 * Refuses silent registry→git rewrites; allows registry-shaped skills/targets updates.
 */
import { ManifestError } from "./errors.ts";
import type { BapmManifest, DependencyEntry, ObjectDependency } from "./types.ts";

/**
 * Merge an incoming APM dependency update into a manifest document.
 * Mutates neither the original document nor existing entries in place —
 * returns a new document. Throws when a registry `id:` identity would be
 * replaced by a git-shaped entry.
 */
export function mergeApmDependencyUpdate(
  document: Record<string, unknown> | BapmManifest,
  incoming: unknown,
): BapmManifest {
  const base = document as BapmManifest;
  const deps = { ...base.dependencies };
  const apm = Array.isArray(deps.apm) ? [...deps.apm] : [];

  const incomingEntry = normalizeIncoming(incoming);
  const incomingId = registryOrPackageIdentity(incomingEntry);
  if (!incomingId) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      "Structured APM dependency update requires a recognizable package identity",
      { path: "dependencies.apm" },
    );
  }

  const idx = apm.findIndex((entry) => entryIdentity(entry) === incomingId);
  if (idx < 0) {
    apm.push(incomingEntry);
    deps.apm = apm;
    return { ...base, dependencies: deps };
  }

  const existing = apm[idx]!;
  const existingIsRegistry = isRegistrySourced(existing);
  const incomingIsGit = isGitShaped(incomingEntry);

  if (existingIsRegistry && incomingIsGit) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `Cannot replace registry identity "${incomingId}" with a git-shaped dependency entry`,
      { path: "dependencies.apm", details: { identity: incomingId } },
    );
  }

  if (existingIsRegistry && isRegistrySourced(incomingEntry)) {
    apm[idx] = mergeRegistryEntries(
      existing as ObjectDependency,
      incomingEntry as ObjectDependency,
    );
    deps.apm = apm;
    return { ...base, dependencies: deps };
  }

  apm[idx] = incomingEntry;
  deps.apm = apm;
  return { ...base, dependencies: deps };
}

/** True when entry is registry object-form (`id:` or bare `registry:`). */
export function isRegistrySourced(entry: DependencyEntry): boolean {
  if (typeof entry !== "object" || entry === null) return false;
  const o = entry as ObjectDependency;
  if (typeof o.id === "string" && o.id.trim()) return true;
  if (typeof o.registry === "string" && o.registry.trim() && !o.git) return true;
  return false;
}

/** True when entry is git-shaped (object `git:` or canonical git string). */
export function isGitShaped(entry: DependencyEntry): boolean {
  if (typeof entry === "string") {
    const t = entry.trim();
    if (!t) return false;
    // Path / local forms are not git
    if (
      t === "local" ||
      t.startsWith("./") ||
      t.startsWith("../") ||
      t.startsWith("/") ||
      t.startsWith("path:")
    ) {
      return false;
    }
    // Marketplace NAME@MARKETPLACE
    if (t.includes("@") && !t.includes("://")) return false;
    // owner/repo or URL → git shorthand
    return t.includes("://") || t.startsWith("git@") || /^[^/]+\/[^/]+/.test(t);
  }
  if (typeof entry === "object" && entry !== null) {
    const o = entry as ObjectDependency;
    return typeof o.git === "string" && o.git.trim().length > 0;
  }
  return false;
}

/** Stable package identity for matching `id: owner/repo` ↔ string `owner/repo`. */
export function entryIdentity(entry: DependencyEntry): string | undefined {
  if (typeof entry === "string") {
    return normalizePackageIdentity(entry);
  }
  if (typeof entry !== "object" || entry === null) return undefined;
  const o = entry as ObjectDependency;
  if (typeof o.id === "string" && o.id.trim()) {
    return normalizePackageIdentity(o.id);
  }
  if (typeof o.git === "string" && o.git.trim()) {
    return normalizePackageIdentity(o.git);
  }
  if (typeof o.alias === "string" && o.alias.trim()) return o.alias.trim();
  if (typeof o.path === "string" && o.path.trim()) return o.path.trim();
  return undefined;
}

export function registryOrPackageIdentity(entry: DependencyEntry): string | undefined {
  return entryIdentity(entry);
}

function normalizeIncoming(incoming: unknown): DependencyEntry {
  if (typeof incoming === "string") return incoming;
  if (incoming === null || typeof incoming !== "object" || Array.isArray(incoming)) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      "Structured APM dependency update must be a string or object entry",
      { path: "dependencies.apm" },
    );
  }
  return { ...(incoming as ObjectDependency) };
}

function mergeRegistryEntries(
  existing: ObjectDependency,
  incoming: ObjectDependency,
): ObjectDependency {
  const merged: ObjectDependency = { ...existing, ...incoming };
  // Never allow git key onto a registry row via merge
  delete merged.git;
  if (typeof existing.id === "string") merged.id = existing.id;
  return merged;
}

function normalizePackageIdentity(raw: string): string {
  let s = raw.trim();
  if (!s) return s;
  // Strip hash ref
  const hash = s.indexOf("#");
  if (hash > 0) s = s.slice(0, hash);
  s = s.replace(/\.git$/i, "");
  if (s.startsWith("git@")) {
    s = s.replace(/^git@/, "").replace(":", "/");
  }
  s = s.replace(/^https?:\/\//i, "").replace(/^ssh:\/\//i, "");
  if (s.startsWith("github.com/")) s = s.slice("github.com/".length);
  // host/owner/repo → owner/repo when three+ segments and first looks like host
  const parts = s.split("/").filter(Boolean);
  if (parts.length >= 3 && parts[0]!.includes(".")) {
    return `${parts[1]}/${parts[2]}`;
  }
  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return s;
}
