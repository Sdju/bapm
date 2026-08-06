/**
 * CLI helpers for Find suite.
 */
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runCli } from "../../src/index.ts";

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-mp-find-cli-"): TempProject {
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

/** Fail if CLI treated the command as unknown (prevents false-green on exit≠0). */
export function expectKnownCommand(combined: string, command: string): void {
  if (/unknown command|not a (?:valid )?command|unrecognized command/i.test(combined)) {
    throw new Error(`CLI treated "${command}" as unknown command:\n${combined}`);
  }
}

export function stdoutText(stdout: string[]): string {
  return stdout.join("\n");
}

export function stderrText(stderr: string[]): string {
  return stderr.join("\n");
}

export function writeText(cwd: string, relative: string, contents: string): string {
  const path = join(cwd, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
  return path;
}

export function writeManifest(cwd: string, name: string): void {
  writeText(
    cwd,
    "bapm.yml",
    `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
  );
}

export function writeLock(cwd: string, contents: string): void {
  writeText(cwd, "bapm.lock.yaml", contents);
}

/** Lock with tracked AGENTS.md + why edge for --path. */
export const FIND_LOCK_YAML = `lockfile_version: "1"
dependencies:
  - name: org/alpha
    repo_url: https://example.com/org/alpha.git
    source: git
    resolved_ref: main
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    deployed_file_hashes:
      AGENTS.md: aaa111
  - name: org/beta
    repo_url: https://example.com/org/beta.git
    source: git
    resolved_tag: v1.0.0
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    resolved_by:
      - org/alpha
    deployed_file_hashes:
      AGENTS.md: bbb222
local_deployed_file_hashes:
  notes/local.md: localhash
`;

export function writeFindProject(cwd: string, name = "mp-find-cli"): void {
  writeManifest(cwd, name);
  writeLock(cwd, FIND_LOCK_YAML);
}
