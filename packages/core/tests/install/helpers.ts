/**
 * Install / materialize test helpers.
 * Reuses resolve ports/temp projects; adds install/primitives accessors.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as core from "@bapm/core";

export {
  createFakePorts,
  createTempProject,
  copyMiniMonorepo,
  depsOf,
  ensureDir,
  expectRejectsMatching,
  expectThrowsMatching,
  fakeCommit,
  listFilesRecursive,
  lockOf,
  writeLock,
  writeManifest,
  writeText,
  type TempProject,
} from "../resolve/helpers.ts";

const suiteDir = dirname(fileURLToPath(import.meta.url));
export const coreRoot = resolve(suiteDir, "../..");
export const repoRoot = resolve(coreRoot, "../..");

export function readCorePackageJson(): {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
} {
  return JSON.parse(readFileSync(join(coreRoot, "package.json"), "utf8")) as {
    name?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
}

/** Prefer `runInstall`, fall back to `installProject` (design allows either). */
export function getRunInstall(): (options: Record<string, unknown>) => Promise<unknown> {
  const c = core as Record<string, unknown>;
  const fn = c.runInstall ?? c.installProject;
  if (typeof fn !== "function") {
    throw new TypeError(
      "expected @bapm/core to export runInstall or installProject (M4 Install public API)",
    );
  }
  return fn as (options: Record<string, unknown>) => Promise<unknown>;
}

export function getDiscoverPrimitives(): (options: Record<string, unknown>) => unknown {
  const fn = (core as Record<string, unknown>).discoverPrimitives;
  if (typeof fn !== "function") {
    throw new TypeError("expected @bapm/core to export discoverPrimitives");
  }
  return fn as (options: Record<string, unknown>) => unknown;
}

export function getResolvePrimitiveConflicts(): (options: Record<string, unknown>) => unknown {
  const c = core as Record<string, unknown>;
  const fn = c.resolvePrimitiveConflicts ?? c.resolveConflicts ?? c.resolvePrimitiveConflict;
  if (typeof fn !== "function") {
    throw new TypeError(
      "expected @bapm/core to export resolvePrimitiveConflicts (or resolveConflicts)",
    );
  }
  return fn as (options: Record<string, unknown>) => unknown;
}

export function primitivesOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    for (const key of ["primitives", "resolved", "items", "set"] as const) {
      if (Array.isArray(r[key])) return r[key] as Record<string, unknown>[];
    }
  }
  throw new TypeError("expected primitives array or { primitives | resolved | items }");
}

export function diagnosticsOf(result: unknown): unknown[] {
  if (!result || typeof result !== "object") return [];
  const r = result as Record<string, unknown>;
  for (const key of ["diagnostics", "warnings", "conflicts", "messages"] as const) {
    if (Array.isArray(r[key])) return r[key] as unknown[];
  }
  return [];
}

export function sourceOf(primitive: Record<string, unknown>): string {
  const raw = primitive.source ?? primitive.attribution ?? primitive.origin ?? primitive.from;
  if (typeof raw === "string") return raw;
  throw new TypeError("expected primitive.source (local | dependency:<name>)");
}

export function nameOf(primitive: Record<string, unknown>): string {
  return String(primitive.name ?? primitive.id ?? primitive.slug ?? "");
}

export function typeOfPrimitive(primitive: Record<string, unknown>): string {
  return String(primitive.type ?? primitive.kind ?? primitive.primitiveType ?? "");
}

export function modulesDir(cwd: string): string {
  const name =
    typeof (core as Record<string, unknown>).APM_MODULES_DIR === "string"
      ? String((core as Record<string, unknown>).APM_MODULES_DIR)
      : "apm_modules";
  return join(cwd, name);
}

export function lockPathCandidates(cwd: string): string[] {
  return [join(cwd, "bapm.lock.yaml"), join(cwd, "apm.lock.yaml")];
}

export function existingLockPath(cwd: string): string | undefined {
  return lockPathCandidates(cwd).find((p) => existsSync(p));
}

export function readLockBytes(cwd: string): Buffer {
  const path = existingLockPath(cwd);
  if (!path) throw new Error("expected lockfile on disk");
  return readFileSync(path);
}

export function hasHarnessWrites(cwd: string, roots: string[]): boolean {
  for (const root of roots) {
    const abs = join(cwd, root);
    if (!existsSync(abs)) continue;
    const files = listUnder(abs);
    if (files.some((f) => /SKILL\.md$|\.mdc$|instructions/i.test(f))) return true;
  }
  return false;
}

function listUnder(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(p.slice(root.length + 1));
    }
  };
  walk(root);
  return out;
}

/** Load bapm-target-api. */
export async function importTargetApi(): Promise<Record<string, unknown>> {
  try {
    return (await import("bapm-target-api")) as Record<string, unknown>;
  } catch (e) {
    throw new TypeError(
      `expected package bapm-target-api to resolve (packages/target-api): ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
}

/** Load bapm-target-cursor via test alias (core must not hard-depend on it). */
export async function importTargetCursor(): Promise<Record<string, unknown>> {
  try {
    return (await import("bapm-target-cursor")) as Record<string, unknown>;
  } catch (e) {
    throw new TypeError(
      `expected package bapm-target-cursor to resolve (packages/target-cursor): ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
}

export function getCreateRegistry(api: Record<string, unknown>): () => unknown {
  const fn = api.createTargetRegistry ?? api.createRegistry ?? api.createTargetApiRegistry;
  if (typeof fn !== "function") {
    throw new TypeError(
      "expected bapm-target-api to export createTargetRegistry (or createRegistry)",
    );
  }
  return fn as () => unknown;
}

export function getRegisterTarget(
  api: Record<string, unknown>,
  registry?: unknown,
): (target: unknown) => unknown {
  if (registry && typeof registry === "object") {
    const reg = registry as Record<string, unknown>;
    if (typeof reg.register === "function") {
      return (target: unknown) => (reg.register as (t: unknown) => unknown)(target);
    }
  }
  const fn = api.registerTarget ?? api.register;
  if (typeof fn !== "function") {
    throw new TypeError("expected bapm-target-api registry.register or registerTarget export");
  }
  return fn as (target: unknown) => unknown;
}

export function listTargets(registry: unknown): Record<string, unknown>[] {
  if (!registry || typeof registry !== "object") {
    throw new TypeError("expected target registry object");
  }
  const r = registry as Record<string, unknown>;
  if (typeof r.list === "function") {
    const listed = (r.list as () => unknown)();
    if (Array.isArray(listed)) return listed as Record<string, unknown>[];
  }
  if (typeof r.getAll === "function") {
    const listed = (r.getAll as () => unknown)();
    if (Array.isArray(listed)) return listed as Record<string, unknown>[];
  }
  if (Array.isArray(r.targets)) return r.targets as Record<string, unknown>[];
  throw new TypeError("expected registry.list() / getAll() / targets");
}

export function deployRootsOf(target: Record<string, unknown>): string[] {
  const roots = target.deployRoots ?? target.roots ?? target.deploy_roots;
  if (Array.isArray(roots)) return roots.map(String);
  if (typeof target.getDeployRoots === "function") {
    const got = (target.getDeployRoots as () => unknown)();
    if (Array.isArray(got)) return got.map(String);
  }
  throw new TypeError("expected target.deployRoots");
}

export function idOfTarget(target: Record<string, unknown>): string {
  return String(target.id ?? target.targetId ?? target.name ?? "");
}
