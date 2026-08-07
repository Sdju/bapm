/**
 * CLI deps test helpers.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runCli } from "../../src/index.ts";

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-p6f-cli-"): TempProject {
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
): Promise<{ result: number; stdout: string[]; stderr: string[]; combined: string }> {
  const { result, stdout, stderr } = await withCwd(cwd, () => withCapturedIo(() => runCli(argv)));
  return {
    result,
    stdout,
    stderr,
    combined: [...stdout, ...stderr].join("\n"),
  };
}

export function stdoutText(stdout: string[]): string {
  return stdout.join("\n");
}

export function stderrText(stderr: string[]): string {
  return stderr.join("\n");
}

export function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

export function writeManifest(cwd: string, name: string): void {
  writeText(join(cwd, "bapm.yml"), `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm: []\n`);
}

export function writeLock(cwd: string, contents: string): void {
  writeText(join(cwd, "bapm.lock.yaml"), contents);
}

/** Unique shared-utils under acme-org (basename + owner/repo short forms). */
export const UNIQUE_SHARED_UTILS_LOCK = `lockfile_version: "1"
dependencies:
  - name: org/parent
    repo_url: https://example.com/org/parent.git
    source: git
    resolved_tag: v1.0.0
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  - name: acme/shared-utils
    repo_url: https://example.com/acme-org/shared-utils.git
    source: git
    resolved_tag: v2.0.0
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    resolved_by:
      - org/parent
`;

/** Two packages sharing basename shared-utils (ambiguous short form). */
export const AMBIGUOUS_BASENAME_LOCK = `lockfile_version: "1"
dependencies:
  - name: acme/shared-utils
    repo_url: https://example.com/acme-org/shared-utils.git
    source: git
    resolved_tag: v1.0.0
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  - name: other/shared-utils
    repo_url: https://example.com/other-org/shared-utils.git
    source: git
    resolved_tag: v2.0.0
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
`;

/**
 * Exact name `shared-utils` (package A) vs different package B whose basename is also shared-utils.
 * Exact form MUST win.
 */
export const EXACT_WINS_BASENAME_LOCK = `lockfile_version: "1"
dependencies:
  - name: shared-utils
    repo_url: https://example.com/named/exact-pkg.git
    source: git
    resolved_tag: v1.0.0
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  - name: other/shared-utils
    repo_url: https://example.com/other-org/shared-utils.git
    source: git
    resolved_tag: v2.0.0
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
`;

/** Direct parent + transitive child with name + repo_url identity. */
export const TRANSITIVE_LOCK = `lockfile_version: "1"
dependencies:
  - name: org/parent
    repo_url: https://example.com/org/parent.git
    source: git
    resolved_tag: v1.0.0
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  - name: org/child
    repo_url: https://example.com/org/child.git
    source: git
    resolved_tag: v2.0.0
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    resolved_by:
      - org/parent
`;

export function writeUniqueSharedUtilsLock(cwd: string): void {
  writeLock(cwd, UNIQUE_SHARED_UTILS_LOCK);
}

export function writeAmbiguousBasenameLock(cwd: string): void {
  writeLock(cwd, AMBIGUOUS_BASENAME_LOCK);
}

export function writeExactWinsBasenameLock(cwd: string): void {
  writeLock(cwd, EXACT_WINS_BASENAME_LOCK);
}

export function writeTransitiveLock(cwd: string): void {
  writeLock(cwd, TRANSITIVE_LOCK);
}

export function writeEmptyLock(cwd: string): void {
  writeLock(cwd, `lockfile_version: "1"\ndependencies: []\n`);
}

export function populateModules(cwd: string, entries: string[] = ["pkg-a", "pkg-b"]): void {
  for (const name of entries) {
    writeText(join(cwd, "apm_modules", name, "marker.txt"), `${name}\n`);
  }
}

export function modulesEntryCount(cwd: string): number {
  const root = join(cwd, "apm_modules");
  if (!existsSync(root)) return 0;
  return readdirSync(root).filter((n) => n !== "." && n !== "..").length;
}

export function modulesEmpty(cwd: string): boolean {
  return modulesEntryCount(cwd) === 0;
}

/** Fail if CLI treated the command path as unknown (prevents false-green on exit≠0). */
export function expectKnownCommand(combined: string, command: string): void {
  if (/unknown command|not a (?:valid )?command|unrecognized command/i.test(combined)) {
    throw new Error(`CLI treated "${command}" as unknown command:\n${combined}`);
  }
}

export function expectKnownDepsSubcommand(combined: string, sub: string): void {
  if (new RegExp(`unknown deps subcommand:\\s*${sub}`, "i").test(combined)) {
    throw new Error(`CLI treated deps "${sub}" as unknown subcommand:\n${combined}`);
  }
}

export function expectKnownFlag(combined: string, flag: string): void {
  const escaped = flag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (
    new RegExp(`unknown deps flag:\\s*${escaped}`, "i").test(combined) ||
    new RegExp(`unknown (?:flag|option):\\s*${escaped}`, "i").test(combined)
  ) {
    throw new Error(`CLI rejected "${flag}" as unknown flag:\n${combined}`);
  }
}

function extractJsonObject(blob: string, stream: string): Record<string, unknown> {
  const body = blob.trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error(`expected JSON object on ${stream}:\n${body}`);
  }
  return JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>;
}

export function parseJsonStdout(stdout: string[]): Record<string, unknown> {
  return extractJsonObject(stdoutText(stdout), "stdout");
}

export function parseJsonStderr(stderr: string[]): Record<string, unknown> {
  return extractJsonObject(stderrText(stderr), "stderr");
}

export { existsSync, join, runCli };
