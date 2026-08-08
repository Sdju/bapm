/**
 * Acceptance helpers for opt-in-host-integrations (CLI surface).
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
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../../../src/index.ts";

export type TempProject = { cwd: string; cleanup: () => void };

const HERE = dirname(fileURLToPath(import.meta.url));
export const CLI_ROOT = resolve(HERE, "../../..");
export const REPO_ROOT = resolve(CLI_ROOT, "../..");

export function createTempProject(prefix = "bapm-acc-opt-in-hosts-"): TempProject {
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

export function expectKnownCommand(combined: string, command: string): void {
  if (/unknown command|not a (?:valid )?command|unrecognized command/i.test(combined)) {
    throw new Error(`CLI treated "${command}" as unknown command:\n${combined}`);
  }
}

export function writeText(cwd: string, relative: string, contents: string): void {
  const path = join(cwd, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
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

export function linkCursorIntegration(projectCwd: string): string {
  return linkPackageDir(projectCwd, join(REPO_ROOT, "packages/integration-cursor"));
}

export function linkClaudeIntegration(projectCwd: string): string {
  return linkPackageDir(projectCwd, join(REPO_ROOT, "packages/integration-claude"));
}

export function linkCodexIntegration(projectCwd: string): string {
  return linkPackageDir(projectCwd, join(REPO_ROOT, "packages/integration-codex"));
}

export type MapProjectOptions = {
  name?: string;
  targets?: Record<string, string>;
  active?: string[];
  /** Legacy string `target:` (no object-map). */
  legacyTarget?: string;
  withLeafSkill?: boolean;
  withCursorDetect?: boolean;
};

export function writeProject(cwd: string, options: MapProjectOptions = {}): void {
  const name = options.name ?? "opt-in-root";
  const lines: string[] = [`name: ${name}`, "version: 0.0.1"];

  if (options.active && options.active.length > 0) {
    lines.push("active:");
    for (const id of options.active) lines.push(`  - ${id}`);
  }

  if (options.targets) {
    const mapLines = Object.entries(options.targets)
      .map(([id, spec]) => `  ${id}: "${spec}"`)
      .join("\n");
    lines.push("targets:", mapLines);
  } else if (options.legacyTarget !== undefined) {
    lines.push(`target: ${options.legacyTarget}`);
  }

  if (options.withLeafSkill) {
    lines.push("dependencies:", "  apm:", "    - path: ./leaf");
  } else {
    lines.push("dependencies:", "  apm: []");
  }

  writeText(cwd, "bapm.yml", `${lines.join("\n")}\n`);

  if (options.withCursorDetect) {
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
}

/** Authoring fixture for Claude marketplace pack. */
export function writeClaudeLocalAuthoring(cwd: string, opts?: { name?: string }): void {
  const name = opts?.name ?? "acme-mp";
  writeText(
    cwd,
    "bapm.yml",
    [
      `name: ${name}`,
      `version: "0.1.0"`,
      `description: Acme marketplace pack fixture`,
      `dependencies:`,
      `  apm: []`,
      `  mcp: []`,
      `marketplace:`,
      `  owner: acme-org`,
      `  build:`,
      `    tagPattern: "v*"`,
      `  outputs:`,
      `    claude: true`,
      `  packages:`,
      `    - name: demo`,
      `      source: ./plugins/demo`,
      ``,
    ].join("\n"),
  );
  writeText(cwd, "plugins/demo/README.md", "# demo plugin\n");
}

export function claudeMarketplacePath(cwd: string): string {
  return join(cwd, ".claude-plugin", "marketplace.json");
}

export function hasClaudeMarketplaceJson(cwd: string): boolean {
  return existsSync(claudeMarketplacePath(cwd));
}

export function readCliPackageJson(): {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
} {
  return JSON.parse(readFileSync(join(CLI_ROOT, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
  };
}

export function readRepoText(relativeFromRepo: string): string {
  return readFileSync(join(REPO_ROOT, relativeFromRepo), "utf8");
}

export { existsSync, join, readFileSync };
