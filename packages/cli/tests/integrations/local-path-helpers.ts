/**
 * CLI helpers for object-map local filesystem path bindings
 * (promoted from manifest-target-integration-local-path acceptance).
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../../src/index.ts";

export type TempProject = { cwd: string; cleanup: () => void };

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURES_DIR = join(HERE, "fixtures");
export const PI_AGENT_FIXTURE = join(FIXTURES_DIR, "pi-agent");

/** Relative in-project path used by happy-path scenarios (matches docs example). */
export const IN_ROOT_PI_REL = "./agents/integration/pi-agent";
export const IN_ROOT_PI_FILE_REL = "./agents/integration/pi-agent/index.mjs";

export function createTempProject(prefix = "bapm-local-path-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

/** Sibling directory next to the project (outside project root). */
export function createOutsideSibling(
  projectCwd: string,
  dirName = "outside-integration",
): string {
  const sibling = join(dirname(projectCwd), dirName);
  rmSync(sibling, { recursive: true, force: true });
  mkdirSync(sibling, { recursive: true });
  return sibling;
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

/** Copy the pi-agent fixture into a directory (in-project or outside). */
export function plantPiAgent(destDir: string): void {
  mkdirSync(destDir, { recursive: true });
  cpSync(PI_AGENT_FIXTURE, destDir, { recursive: true });
}

/** Plant pi-agent under the documented in-root relative path. */
export function plantInRootPiAgent(projectCwd: string): string {
  const dest = join(projectCwd, "agents", "integration", "pi-agent");
  plantPiAgent(dest);
  return IN_ROOT_PI_REL;
}

/** Symlink a promoted-style npm fixture name into node_modules (for npm regression). */
export function linkNamedPackage(
  projectCwd: string,
  packageName: string,
  fixtureRoot: string,
): string {
  const segments = packageName.split("/");
  const dest = join(projectCwd, "node_modules", ...segments);
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  symlinkSync(fixtureRoot, dest, "dir");
  return packageName;
}

export type MapProjectOptions = {
  name?: string;
  targets: Record<string, string>;
  withCursor?: boolean;
  withLeafSkill?: boolean;
  withInstruction?: boolean;
};

export function writeMapProject(cwd: string, options: MapProjectOptions): void {
  const name = options.name ?? "local-path-root";
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

export function piMarkerPath(cwd: string): string {
  return join(cwd, ".pi", "materialized");
}

export function piCompilePath(cwd: string): string {
  return join(cwd, "PI.md");
}

export function absPath(cwd: string, ...parts: string[]): string {
  return resolve(cwd, ...parts);
}

export { existsSync, join, readFileSync, dirname };
