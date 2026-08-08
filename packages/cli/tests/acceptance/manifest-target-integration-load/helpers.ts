/**
 * Acceptance helpers for manifest-target-integration-load (CLI map load).
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../../../src/index.ts";

export type TempProject = { cwd: string; cleanup: () => void };

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURES_DIR = join(HERE, "fixtures");

export function createTempProject(prefix = "bapm-acc-map-load-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

export async function withCapturedIo<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; stdout: string[]; stderr: string[] }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (msg?: unknown) => {
    stdout.push(String(msg));
  };
  console.error = (msg?: unknown) => {
    stderr.push(String(msg));
  };
  try {
    const result = await fn();
    return { result, stdout, stderr };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

export async function withCwd<T>(cwd: string, fn: () => Promise<T>): Promise<T> {
  const prev = process.cwd();
  process.chdir(cwd);
  try {
    return await fn();
  } finally {
    process.chdir(prev);
  }
}

export async function runInProject(
  cwd: string,
  argv: string[],
  env: Record<string, string | undefined> = {},
): Promise<{ result: number; stdout: string[]; stderr: string[]; combined: string }> {
  const keys = new Set(["CI", ...Object.keys(env)]);
  const saved: Record<string, string | undefined> = {};
  for (const k of keys) {
    saved[k] = process.env[k];
  }
  delete process.env.CI;
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    const { result, stdout, stderr } = await withCwd(cwd, () => withCapturedIo(() => runCli(argv)));
    return {
      result,
      stdout,
      stderr,
      combined: [...stdout, ...stderr].join("\n"),
    };
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

export function writeText(cwd: string, relative: string, contents: string): void {
  const path = join(cwd, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

/** Symlink a fixture package into project node_modules under its package.json name. */
export function linkFixturePackage(projectCwd: string, fixtureDirName: string): string {
  const fixtureRoot = join(FIXTURES_DIR, fixtureDirName);
  const pkg = JSON.parse(readFileSync(join(fixtureRoot, "package.json"), "utf8")) as {
    name: string;
  };
  const name = pkg.name;
  const segments = name.split("/");
  const dest = join(projectCwd, "node_modules", ...segments);
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  symlinkSync(fixtureRoot, dest, "dir");
  return name;
}

export type MapProjectOptions = {
  name?: string;
  /** Object-map host→package bindings. */
  targets: Record<string, string>;
  /** When true, create `.cursor/` so built-in cursor can detect. */
  withCursor?: boolean;
  /** Local leaf dep with a skill (for materialize observation). */
  withLeafSkill?: boolean;
  /** Local instruction primitive for compile. */
  withInstruction?: boolean;
};

/** Project using object-map `targets` plus optional leaf skill / instruction. */
export function writeMapProject(cwd: string, options: MapProjectOptions): void {
  const name = options.name ?? "map-load-root";
  const mapLines = Object.entries(options.targets)
    .map(([id, spec]) => `  ${id}: "${spec}"`)
    .join("\n");

  const deps = options.withLeafSkill
    ? ["dependencies:", "  apm:", "    - path: ./leaf"]
    : ["dependencies:", "  apm: []"];

  writeText(
    cwd,
    "bapm.yml",
    [`name: ${name}`, "version: 0.0.1", "targets:", mapLines, ...deps, ""].join("\n"),
  );

  if (options.withCursor) {
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
  }

  if (options.withLeafSkill) {
    writeText(
      cwd,
      "leaf/apm.yml",
      "name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n",
    );
    writeText(
      cwd,
      "leaf/.apm/skills/hello/SKILL.md",
      "---\nname: hello\n---\n# Hello\n",
    );
  }

  if (options.withInstruction) {
    writeText(cwd, ".apm/instructions/guide.md", "# Guide\nPrefer short answers.\n");
  }
}

/** Legacy string `target: cursor` project (must not trigger package load from the field). */
export function writeLegacyCursorProject(cwd: string, name = "legacy-cursor"): void {
  mkdirSync(join(cwd, ".cursor"), { recursive: true });
  writeText(
    cwd,
    "bapm.yml",
    `name: ${name}\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm: []\n`,
  );
  writeText(cwd, ".apm/skills/hello/SKILL.md", "---\nname: hello\n---\n# Hello\n");
}

export function acmeMarkerPath(cwd: string): string {
  return join(cwd, ".acme", "materialized");
}

export function acmeCompilePath(cwd: string): string {
  return join(cwd, "ACME.md");
}

export { existsSync, join, readFileSync };
