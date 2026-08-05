/**
 * CLI compile polish helpers (-o/--dry-run/-v/--validate).
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runCli } from "../../src/index.ts";
import {
  formatCompileHelp,
  parseCompileArgs,
} from "../../src/modules/Compile/services/runCompile.ts";

export { formatCompileHelp, parseCompileArgs, runCli };

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-p7d-cli-"): TempProject {
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

export function expectKnownCommand(combined: string, command: string): void {
  if (/unknown command|not a (?:valid )?command|unrecognized command/i.test(combined)) {
    throw new Error(`CLI treated "${command}" as unknown command:\n${combined}`);
  }
}

/** Fail if CLI rejected a compile polish flag as unknown (prevents false-green). */
export function expectKnownCompileFlag(combined: string, flag: string): void {
  const escaped = flag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (
    new RegExp(`unknown compile flag:\\s*${escaped}`, "i").test(combined) ||
    new RegExp(`unknown (?:flag|option):\\s*${escaped}`, "i").test(combined)
  ) {
    throw new Error(`CLI rejected "${flag}" as unknown flag:\n${combined}`);
  }
}

export function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

/** Cursor-oriented fixture with one discoverable instruction primitive. */
export function writeCompileProject(cwd: string, name = "p7d-compile"): void {
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

export function readAgents(cwd: string): string {
  return readFileSync(agentsPath(cwd), "utf8");
}

export function foreignHostPaths(cwd: string): string[] {
  return [
    join(cwd, "CLAUDE.md"),
    join(cwd, "GEMINI.md"),
    join(cwd, ".github", "copilot-instructions.md"),
  ];
}

export function assertNoForeignHosts(cwd: string): void {
  for (const path of foreignHostPaths(cwd)) {
    if (existsSync(path)) {
      throw new Error(`foreign-host file must not exist: ${path}`);
    }
  }
  if (existsSync(join(cwd, ".claude"))) {
    throw new Error("foreign-host directory .claude must not exist");
  }
}

export { existsSync, join, readFileSync };
