/**
 * User-scope (global) project root: `~/.bapm` (or `BAPM_HOME`).
 *
 * The global root owns `bapm.yml` + `bapm.lock.yaml`; project manifests and
 * locks are never read or written for `bapm install --global`.
 */

import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createMinimalManifest, writeLockfile, writeProducerManifest } from "@b-apm/core";

export type GlobalProjectPaths = {
  root: string;
  manifestPath: string | null;
  lockPath: string | null;
};

/** Resolve `BAPM_HOME` (absolute or relative to cwd) or `~/.bapm`. */
export function resolveGlobalProjectRoot(
  env: Record<string, string | undefined> = process.env,
): string {
  const override = env.BAPM_HOME?.trim();
  if (override) return resolve(override);
  return join(homedir(), ".bapm");
}

function findManifestPath(root: string): string | undefined {
  for (const name of ["bapm.yml", "apm.yml"]) {
    const candidate = join(root, name);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function findLockPath(root: string): string | undefined {
  for (const name of ["bapm.lock.yaml", "apm.lock.yaml"]) {
    const candidate = join(root, name);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Ensure the global root has a manifest and lock so an MCP-only configure pass
 * can record inventory. Existing files are never overwritten.
 */
export function ensureGlobalProject(root: string): GlobalProjectPaths {
  mkdirSync(root, { recursive: true, mode: 0o700 });

  let manifestPath = findManifestPath(root);
  if (!manifestPath) {
    const document = createMinimalManifest({ name: "global", version: "0.1.0" });
    manifestPath = writeProducerManifest(document, {
      cwd: root,
      path: join(root, "bapm.yml"),
    }).path;
  }

  let lockPath = findLockPath(root);
  if (!lockPath) {
    lockPath = writeLockfile(
      { lockfile_version: "1", dependencies: [] },
      { cwd: root, sourceFilename: "bapm.lock.yaml" },
    );
  }

  return { root, manifestPath, lockPath };
}

/** Read-only view; used by `bapm mcp list/show --global`. */
export function inspectGlobalProject(root: string): GlobalProjectPaths {
  return {
    root,
    manifestPath: findManifestPath(root) ?? null,
    lockPath: findLockPath(root) ?? null,
  };
}
