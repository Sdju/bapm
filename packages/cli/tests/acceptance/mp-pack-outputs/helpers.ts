/**
 * CLI helpers for mp-pack-outputs acceptance (RED).
 */
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
import { dirname, join } from "node:path";
import { expect } from "vite-plus/test";
import { runCli } from "../../../src/index.ts";

export type TempProject = { cwd: string; root: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-mp-pack-outputs-cli-"): TempProject {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const cwd = join(root, "project");
  mkdirSync(cwd, { recursive: true });
  return {
    root,
    cwd,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
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
): Promise<{ result: number; stdout: string[]; stderr: string[]; combined: string }> {
  const { result, stdout, stderr } = await withCwd(cwd, () => withCapturedIo(() => runCli(argv)));
  return {
    result,
    stdout,
    stderr,
    combined: [...stdout, ...stderr].join("\n"),
  };
}

/** Fail if CLI treated the command as unknown (prevents false-green on exit≠0). */
export function expectKnownCommand(combined: string, command: string): void {
  if (/unknown command|not a (?:valid )?command|unrecognized command/i.test(combined)) {
    throw new Error(`CLI treated "${command}" as unknown command:\n${combined}`);
  }
}

export function writeText(cwd: string, relative: string, contents: string): string {
  const path = join(cwd, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
  return path;
}

export function readText(cwd: string, relative: string): string {
  return readFileSync(join(cwd, relative), "utf8");
}

export function findZipUnder(cwd: string): string | undefined {
  if (!existsSync(cwd)) return undefined;
  for (const name of readdirSync(cwd)) {
    const p = join(cwd, name);
    if (statSync(p).isFile() && name.endsWith(".zip")) return p;
  }
  return undefined;
}

export function claudeMarketplacePath(cwd: string): string {
  return join(cwd, ".claude-plugin", "marketplace.json");
}

export function codexMarketplacePath(cwd: string): string {
  return join(cwd, ".agents", "plugins", "marketplace.json");
}

export function hasClaudeMarketplaceJson(cwd: string): boolean {
  return existsSync(claudeMarketplacePath(cwd));
}

export function hasCodexMarketplaceJson(cwd: string): boolean {
  return existsSync(codexMarketplacePath(cwd));
}

export function hasAnyHostMarketplaceJson(cwd: string): boolean {
  return hasClaudeMarketplaceJson(cwd) || hasCodexMarketplaceJson(cwd);
}

/** Conforming dual-read manifest (packable M7 tree). */
export function writeConformingManifest(
  cwd: string,
  options?: { name?: string; version?: string },
): void {
  const name = options?.name ?? "cli-pack";
  const version = options?.version ?? "1.2.3";
  writeText(
    cwd,
    "bapm.yml",
    `name: ${name}\nversion: "${version}"\ndependencies:\n  apm: []\n  mcp: []\n`,
  );
}

/** Authoring with local package + Claude output (default path). */
export function writeClaudeLocalAuthoring(
  cwd: string,
  opts?: { name?: string; withManifestDeps?: boolean },
): void {
  const name = opts?.name ?? "acme-mp";
  const deps =
    opts?.withManifestDeps === false
      ? ""
      : `dependencies:\n  apm: []\n  mcp: []\n`;
  writeText(
    cwd,
    "bapm.yml",
    [
      `name: ${name}`,
      `version: "0.1.0"`,
      `description: Acme marketplace pack fixture`,
      deps.trimEnd(),
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
    ]
      .filter((line) => line !== "")
      .join("\n"),
  );
  writeText(cwd, "plugins/demo/README.md", "# demo plugin\n");
}

/** Authoring with Codex output + category on every package. */
export function writeCodexLocalAuthoring(cwd: string, opts?: { category?: string | null }): void {
  const category = opts?.category === undefined ? "tools" : opts.category;
  const categoryLine =
    category === null ? "" : `      category: ${category}`;
  writeText(
    cwd,
    "bapm.yml",
    [
      `name: codex-mp`,
      `version: "0.2.0"`,
      `description: Codex marketplace pack fixture`,
      `marketplace:`,
      `  owner: acme-org`,
      `  outputs:`,
      `    codex: true`,
      `  packages:`,
      `    - name: demo`,
      `      source: ./plugins/demo`,
      categoryLine,
      ``,
    ]
      .filter((line) => line !== "")
      .join("\n"),
  );
  writeText(cwd, "plugins/demo/README.md", "# demo\n");
}

/** Remote github shorthand package (needs network resolve unless offline fail). */
export function writeRemoteGithubAuthoring(cwd: string): void {
  writeText(
    cwd,
    "bapm.yml",
    [
      `name: remote-mp`,
      `version: "0.1.0"`,
      `marketplace:`,
      `  owner: acme-org`,
      `  build:`,
      `    tagPattern: "v*"`,
      `  outputs:`,
      `    claude: true`,
      `  packages:`,
      `    - name: tools`,
      `      source: acme/tools`,
      `      ref: main`,
      ``,
    ].join("\n"),
  );
}

export function parseJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function assertTrailingNewlineIndent2(raw: string): void {
  expect(raw.endsWith("\n"), "marketplace.json must end with trailing newline").toBe(true);
  // Pretty-printed objects use two-space indent on nested keys.
  expect(raw).toMatch(/\n {2}"/);
}

export { existsSync, join, runCli, readFileSync };
