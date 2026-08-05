/**
 * p6g-update-flag-polish acceptance helpers (core).
 */
import * as core from "@bapm/core";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createFakePorts,
  createTempProject,
  fakeCommit,
  writeLock,
  writeManifest,
  writeText,
  type TempProject,
} from "../../lifecycle/helpers.ts";

export {
  createFakePorts,
  createTempProject,
  fakeCommit,
  writeLock,
  writeManifest,
  writeText,
  type TempProject,
};

export const suiteDir = dirname(fileURLToPath(import.meta.url));
export const coreRoot = resolve(suiteDir, "../../..");

type AnyFn = (...args: never[]) => unknown;

function pickExport(names: string[]): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(
    `expected @bapm/core to export one of [${names.join(", ")}] (p6g update)`,
  );
}

export function getRunUpdate(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["runUpdate", "updateProject", "update"]) as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function textOf(result: unknown): string {
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    for (const key of ["text", "output", "stdout", "message"] as const) {
      if (typeof r[key] === "string") return r[key] as string;
    }
  }
  return String(result ?? "");
}

export function planOf(result: unknown): Array<Record<string, unknown>> {
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (Array.isArray(r.plan)) return r.plan as Array<Record<string, unknown>>;
  }
  return [];
}

export function keepPlanPattern(): RegExp {
  return /\[=\].*\bkeep\b/i;
}

export function honestEmptyChangePattern(): RegExp {
  return /no dependency changes|nothing to (?:update|change)|up to date|no updates?/i;
}

export function readUpdateTypesSource(): string {
  return readFileSync(join(coreRoot, "src/modules/Update/types.ts"), "utf8");
}

export function readUpdateRunSource(): string {
  return readFileSync(join(coreRoot, "src/modules/Update/runUpdate.ts"), "utf8");
}

/** Leaf path project — dry-run plan is all-keep. */
export function writeLeafFixture(cwd: string, name: string): void {
  writeManifest(
    cwd,
    "bapm.yml",
    `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
  );
  writeText(
    join(cwd, "leaf", "apm.yml"),
    `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
  );
  writeLock(
    cwd,
    "bapm.lock.yaml",
    `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n`,
  );
}

/**
 * Mixed plan fixture: git pkg that can bump + local keep (via fake tagLister).
 */
export function writeMixedPlanFixture(cwd: string): {
  ports: ReturnType<typeof createFakePorts>;
  oldCommit: string;
  newCommit: string;
} {
  const oldCommit = fakeCommit("p6g-old");
  const newCommit = fakeCommit("p6g-new");
  const ports = createFakePorts({
    tagsByRepo: {
      "example/pkg-a": [
        { tag: "v1.0.0", commit: oldCommit },
        { tag: "v1.1.0", commit: newCommit },
      ],
    },
  });

  writeManifest(
    cwd,
    "bapm.yml",
    `name: p6g-mixed\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://github.com/example/pkg-a.git\n      ref: "^1.0.0"\n    - path: ./leaf\n`,
  );
  writeText(
    join(cwd, "leaf", "apm.yml"),
    `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
  );
  writeLock(
    cwd,
    "bapm.lock.yaml",
    `lockfile_version: "1"
dependencies:
  - repo_url: github.com/example/pkg-a
    name: pkg-a
    resolved_commit: "${oldCommit}"
    resolved_tag: v1.0.0
  - repo_url: local:leaf
    name: leaf
    source: local
    path: leaf
`,
  );

  return { ports, oldCommit, newCommit };
}
