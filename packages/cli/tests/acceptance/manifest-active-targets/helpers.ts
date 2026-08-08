/**
 * Acceptance helpers for manifest-active-targets (CLI surface).
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

export function createTempProject(prefix = "bapm-acc-active-cli-"): TempProject {
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

/** Symlink a workspace package directory into the project's node_modules. */
export function linkPackageDir(projectCwd: string, packageRoot: string): string {
  const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
    name: string;
  };
  const name = pkg.name;
  const dest = join(projectCwd, "node_modules", ...name.split("/"));
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  symlinkSync(packageRoot, dest, "dir");
  return name;
}

/** Workspace `@bapm/integration-cursor` for object-map keys that must include cursor. */
export function linkCursorIntegration(projectCwd: string): string {
  const root = join(HERE, "..", "..", "..", "..", "integration-cursor");
  return linkPackageDir(projectCwd, root);
}

export type ActiveProjectOptions = {
  name?: string;
  active: string[];
  /** Object-map host→package bindings (optional). */
  targets?: Record<string, string>;
  /** Legacy string/array targets preference. */
  legacyTargets?: string[];
  filename?: "bapm.yml" | "apm.yml";
  withLeafSkill?: boolean;
  withInstruction?: boolean;
  /** Create `.cursor/` detect signal (default false — active must drive selection). */
  withCursor?: boolean;
};

export function writeActiveProject(cwd: string, options: ActiveProjectOptions): void {
  const name = options.name ?? "active-root";
  const filename = options.filename ?? "bapm.yml";
  const activeLines = options.active.map((id) => `  - ${id}`).join("\n");

  const lines: string[] = [`name: ${name}`, "version: 0.0.1", "active:", activeLines];

  if (options.targets) {
    const mapLines = Object.entries(options.targets)
      .map(([id, spec]) => `  ${id}: "${spec}"`)
      .join("\n");
    lines.push("targets:", mapLines);
  } else if (options.legacyTargets) {
    lines.push("targets:");
    for (const id of options.legacyTargets) {
      lines.push(`  - ${id}`);
    }
  }

  if (options.withLeafSkill) {
    lines.push("dependencies:", "  apm:", "    - path: ./leaf");
  } else {
    lines.push("dependencies:", "  apm: []");
  }

  writeText(cwd, filename, `${lines.join("\n")}\n`);

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

export function acmeMarkerPath(cwd: string): string {
  return join(cwd, ".acme", "materialized");
}

export function acmeCompilePath(cwd: string): string {
  return join(cwd, "ACME.md");
}

export { existsSync, join, readFileSync };
