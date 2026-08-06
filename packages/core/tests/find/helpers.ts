/**
 * Helpers for Find suite (core). Soft-resolve @bapm/core Find APIs.
 */
import * as core from "@bapm/core";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { LockedDependency, LockfileDocument } from "@bapm/core";

export const suiteDir = dirname(fileURLToPath(import.meta.url));
export const coreRoot = resolve(suiteDir, "../..");
export const srcRoot = join(coreRoot, "src");

type AnyFn = (...args: never[]) => unknown;

export function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @bapm/core to export one of [${names.join(", ")}] (${label})`);
}

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-mp-find-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

export function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

export function writeLock(cwd: string, contents: string): void {
  writeText(join(cwd, "bapm.lock.yaml"), contents);
}

export function writeManifest(cwd: string, name: string): void {
  writeText(
    join(cwd, "bapm.yml"),
    `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
  );
}

export function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  throw new TypeError(`expected object, got ${typeof value}`);
}

/** Sample lock: two deps share AGENTS.md; local hash; directory prefixes; why edges. */
export function sampleFindDocument(): LockfileDocument {
  return {
    lockfile_version: "1",
    dependencies: [
      {
        name: "org/alpha",
        repo_url: "https://example.com/org/alpha.git",
        source: "git",
        resolved_ref: "main",
        resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        deployed_file_hashes: {
          "AGENTS.md": "aaa111",
          "skills/": "diralpha",
          "skills/foo/": "dirfoo",
          "skills/foo/SKILL.md": "skillalpha",
        },
        deployed_files: ["AGENTS.md"],
      },
      {
        name: "org/beta",
        repo_url: "https://example.com/org/beta.git",
        source: "git",
        resolved_tag: "v1.0.0",
        resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        resolved_by: ["org/alpha"],
        deployed_file_hashes: {
          "AGENTS.md": "bbb222",
        },
        // list-only path (no hash) — union scenario
        deployed_files: ["shared/x.md"],
      },
    ],
    local_deployed_file_hashes: {
      "notes/local.md": "localhash",
    },
  };
}

export function sampleFindLockYaml(): string {
  return `lockfile_version: "1"
dependencies:
  - name: org/alpha
    repo_url: https://example.com/org/alpha.git
    source: git
    resolved_ref: main
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    deployed_file_hashes:
      AGENTS.md: aaa111
      "skills/": diralpha
      "skills/foo/": dirfoo
      skills/foo/SKILL.md: skillalpha
    deployed_files:
      - AGENTS.md
  - name: org/beta
    repo_url: https://example.com/org/beta.git
    source: git
    resolved_tag: v1.0.0
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    resolved_by:
      - org/alpha
    deployed_file_hashes:
      AGENTS.md: bbb222
    deployed_files:
      - shared/x.md
local_deployed_file_hashes:
  notes/local.md: localhash
`;
}

export function getBuildReverseIndex() {
  return pickExport(
    ["buildReverseIndex", "build_reverse_index", "buildFindReverseIndex"],
    "buildReverseIndex",
  ) as (document: LockfileDocument | Record<string, unknown>) => unknown;
}

export function getLookupInIndex() {
  return pickExport(
    ["lookupInIndex", "lookup", "lookupFindPath", "lookupReverseIndex"],
    "lookupInIndex",
  ) as (query: string, index: unknown) => unknown;
}

export function getFindPath() {
  return pickExport(
    ["findPath", "runFind", "findDeployedPath", "runFindPath"],
    "findPath orchestration",
  ) as (options: Record<string, unknown>) => unknown | Promise<unknown>;
}

export function getApplyDeployedHashesToLock() {
  return pickExport(
    ["applyDeployedHashesToLock"],
    "applyDeployedHashesToLock",
  ) as (args: Record<string, unknown>) => boolean;
}

export function getFormatOrigin() {
  return pickExport(
    ["formatFindOrigin", "formatOrigin", "formatSourceOrigin", "_formatOrigin"],
    "origin formatter",
  ) as (owner: unknown, dep?: LockedDependency | Record<string, unknown> | null) => string;
}

export function getOwnerLabel() {
  return pickExport(
    ["formatFindOwnerLabel", "ownerLabel", "formatOwnerLabel", "findOwnerLabel"],
    "owner label",
  ) as (owner: unknown, dep?: LockedDependency | Record<string, unknown> | null) => string;
}

/** Normalize lookup result to ordered owner key strings. */
export function ownersOf(result: unknown): string[] {
  if (result == null) return [];
  if (Array.isArray(result)) {
    return result.map((item) => {
      if (typeof item === "string") return item;
      const row = asRecord(item);
      return String(row.key ?? row.owner ?? row.id ?? row.name ?? row.repo_url ?? "");
    });
  }
  const row = asRecord(result);
  if (Array.isArray(row.owners)) return ownersOf(row.owners);
  if (Array.isArray(row.keys)) return ownersOf(row.keys);
  throw new TypeError("unrecognized lookup result shape");
}

/** Extract owners for a path from either Map-like index or object map. */
export function indexOwnersFor(index: unknown, path: string): string[] {
  if (index == null) return [];
  if (index instanceof Map) {
    return ownersOf(index.get(path));
  }
  if (typeof index === "object") {
    const bag = index as Record<string, unknown>;
    // Prefer dedicated accessor if present
    if (typeof bag.get === "function") {
      return ownersOf((bag.get as (p: string) => unknown).call(index, path));
    }
    if (bag.paths && typeof bag.paths === "object") {
      return ownersOf((bag.paths as Record<string, unknown>)[path]);
    }
    if (bag.index && typeof bag.index === "object") {
      return indexOwnersFor(bag.index, path);
    }
    if (path in bag) return ownersOf(bag[path]);
  }
  // Fall back to lookup API
  return ownersOf(getLookupInIndex()(path, index));
}

export function findResultOf(result: unknown): {
  exitCode: number;
  ok: boolean;
  text: string;
  stderr: string;
} {
  const row = asRecord(result);
  const exitCode = Number(row.exitCode ?? row.code ?? (row.ok === false ? 1 : 0));
  const text = String(row.text ?? row.stdout ?? row.output ?? row.message ?? "");
  const stderr = String(row.stderr ?? row.errorText ?? row.error ?? "");
  const ok = typeof row.ok === "boolean" ? row.ok : exitCode === 0;
  return { exitCode, ok, text, stderr: stderr === "[object Object]" ? JSON.stringify(row.error) : stderr };
}

export async function invokeFind(
  options: Record<string, unknown>,
): Promise<ReturnType<typeof findResultOf>> {
  const out = await Promise.resolve(getFindPath()(options));
  return findResultOf(out);
}

export function readSrc(rel: string): string {
  return readFileSync(join(srcRoot, rel), "utf8");
}
