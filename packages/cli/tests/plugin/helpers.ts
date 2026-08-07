/**
 * CLI helpers for plugin init suite.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { expect } from "vite-plus/test";
import { runCli } from "../../src/index.ts";

export type TempProject = { cwd: string; root: string; cleanup: () => void };

/** Temp tree with a kebab-safe project cwd (basename is a valid plugin id). */
export function createTempProject(options?: { prefix?: string; basename?: string }): TempProject {
  const root = mkdtempSync(join(tmpdir(), options?.prefix ?? "bapm-mp-plugin-init-cli-"));
  const dirName = options?.basename ?? "demo-plugin";
  const cwd = join(root, dirName);
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

export function readText(cwd: string, relative: string): string {
  return readFileSync(join(cwd, relative), "utf8");
}

export function listTopLevel(cwd: string): string[] {
  if (!existsSync(cwd)) return [];
  return readdirSync(cwd);
}

export function isDirectory(cwd: string, relative: string): boolean {
  const path = join(cwd, relative);
  return existsSync(path) && statSync(path).isDirectory();
}

export function assertThinScaffold(cwd: string): void {
  expect(existsSync(join(cwd, "plugin.json"))).toBe(true);
  expect(existsSync(join(cwd, "bapm.yml"))).toBe(true);
  expect(existsSync(join(cwd, "SKILL.md"))).toBe(false);
  expect(existsSync(join(cwd, "start.prompt"))).toBe(false);
  expect(isDirectory(cwd, "agents")).toBe(false);
  expect(isDirectory(cwd, "skills")).toBe(false);
}

export function cwdBasename(cwd: string): string {
  return basename(cwd);
}

export { existsSync, join, runCli, writeFileSync };
