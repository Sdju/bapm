import { resolve } from "node:path";
import {
  loadManifest,
  type BapmManifest,
  type DependencyEntry,
  type ObjectDependency,
} from "@/modules/Manifest";
import { loadLockfileOrNull, type LockedDependency } from "@/modules/Lockfile";
import { normalizeRepoIdentity, toLockRepoUrl } from "@/modules/Resolver";
import { InstallError } from "./errors.ts";
import type { EnforceFrozenOptions } from "./types.ts";

/**
 * Basic frozen gate (lk-006): reject frozen+update; require lock; require direct pins.
 * Call before any modules/lock/target mutation.
 */
export function enforceFrozen(options: EnforceFrozenOptions = {}): void {
  const cwd = resolve(options.cwd ?? process.cwd());
  const updateRefs = options.updateRefs === true || options.update === true;

  if (updateRefs) {
    throw new InstallError(
      "INSTALL_FROZEN_UPDATE_REJECTED",
      "Frozen mode rejects update/re-resolve flags (frozen+update mutation rejected)",
    );
  }

  const loaded = loadLockfileOrNull({ cwd });
  if (!loaded) {
    throw new InstallError(
      "INSTALL_FROZEN_NO_LOCK",
      "Frozen install requires an existing lockfile; lock is absent",
    );
  }

  const { document: manifest } = loadManifest({ cwd });
  const missing = missingDirectPins(manifest, loaded.document.dependencies ?? []);
  if (missing.length > 0) {
    throw new InstallError(
      "INSTALL_FROZEN_MISSING_PIN",
      `Frozen install missing direct dependency pin(s): ${missing.join(", ")}`,
      { details: { missing } },
    );
  }
}

function missingDirectPins(manifest: BapmManifest, lockDeps: LockedDependency[]): string[] {
  const direct = listDirectApm(manifest);
  const missing: string[] = [];

  for (const entry of direct) {
    if (!hasPin(entry, lockDeps)) {
      missing.push(summarize(entry));
    }
  }
  return missing;
}

function listDirectApm(manifest: BapmManifest): DependencyEntry[] {
  const apm = manifest.dependencies?.apm;
  return Array.isArray(apm) ? apm : [];
}

function hasPin(entry: DependencyEntry, lockDeps: LockedDependency[]): boolean {
  const n = normalizeEntry(entry);
  if (typeof n === "string") {
    // string specs: match by identity fragment
    return lockDeps.some((d) => {
      const repo = String(d.repo_url ?? d.name ?? "");
      return repo.includes(n) || String(d.name ?? "").includes(n);
    });
  }
  const obj = n as ObjectDependency;
  if (obj.git) {
    const identity = toLockRepoUrl(obj.git);
    return lockDeps.some((d) => {
      const repo = String(d.repo_url ?? "");
      if (!repo) return false;
      if (repo.startsWith("local:")) return false;
      const locked = normalizeRepoIdentity(repo.includes("://") ? repo : `https://${repo}`);
      return locked === identity || repo === identity || repo.endsWith(identity);
    });
  }
  if (obj.path) {
    const pathKey = obj.path.replace(/^\.\//, "").replace(/\/+$/, "");
    const base = pathKey.split("/").filter(Boolean).pop() ?? pathKey;
    return lockDeps.some((d) => {
      const raw = d as Record<string, unknown>;
      const dPath = typeof raw.path === "string" ? raw.path.replace(/^\.\//, "") : "";
      const repo = String(d.repo_url ?? "");
      const name = String(d.name ?? "");
      return (
        dPath === pathKey ||
        dPath === base ||
        dPath.endsWith(base) ||
        repo === pathKey ||
        repo === base ||
        repo.endsWith(`/${base}`) ||
        repo.includes(`local:${pathKey}`) ||
        repo.includes(`local_${base}`) ||
        name === base
      );
    });
  }
  // registry/id — soft: require some lock entry with matching id/name
  if (obj.id) {
    return lockDeps.some(
      (d) => String(d.name ?? "") === obj.id || String(d.repo_url ?? "").includes(obj.id!),
    );
  }
  return false;
}

function normalizeEntry(entry: DependencyEntry): unknown {
  if (typeof entry === "string") return entry;
  if (
    entry &&
    typeof entry === "object" &&
    "spec" in entry &&
    !("git" in entry) &&
    !("path" in entry)
  ) {
    return (entry as { spec: string }).spec;
  }
  return entry;
}

function summarize(entry: DependencyEntry): string {
  const n = normalizeEntry(entry);
  if (typeof n === "string") return n;
  const o = n as ObjectDependency;
  if (o.git) return o.git;
  if (o.path) return o.path;
  if (o.id) return o.id;
  return "dep";
}
