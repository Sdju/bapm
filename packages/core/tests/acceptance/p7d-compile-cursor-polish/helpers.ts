/**
 * p7d-compile-cursor-polish acceptance helpers (core).
 */
import * as core from "@bapm/core";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export type TempProject = { cwd: string; cleanup: () => void };

type AnyFn = (...args: never[]) => unknown;

export function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @bapm/core to export one of [${names.join(", ")}] (${label})`);
}

export function getCompileAgentsMd(): (options?: Record<string, unknown>) => Record<string, unknown> {
  return pickExport(
    ["compileAgentsMd", "compileProject", "runCompile", "emitAgentsMd"],
    "compile agents md",
  ) as (options?: Record<string, unknown>) => Record<string, unknown>;
}

export function createTempProject(prefix = "bapm-p7d-core-"): TempProject {
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

/** Cursor-oriented fixture with one discoverable instruction primitive. */
export function writeCompileProject(cwd: string, name = "p7d-compile-core"): void {
  mkdirSync(join(cwd, ".cursor"), { recursive: true });
  writeText(
    join(cwd, "bapm.yml"),
    `name: ${name}\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm: []\n`,
  );
  writeText(
    join(cwd, ".apm", "instructions", "style.md"),
    "# Style\nPrefer concise answers.\n",
  );
}

export function agentsPath(cwd: string): string {
  return join(cwd, "AGENTS.md");
}

export type AttributionEntry = {
  name?: unknown;
  type?: unknown;
  path?: unknown;
};

export function attributionOf(result: Record<string, unknown>): AttributionEntry[] {
  const raw =
    result.attribution ?? result.sources ?? result.primitives ?? result.verboseSources;
  if (!Array.isArray(raw)) {
    throw new TypeError(
      `expected compile result attribution/sources array, got: ${JSON.stringify(result)}`,
    );
  }
  return raw as AttributionEntry[];
}

export { existsSync, join, readFileSync };
