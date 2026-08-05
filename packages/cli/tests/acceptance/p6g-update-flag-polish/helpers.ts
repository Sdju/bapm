/**
 * p6g-update-flag-polish acceptance helpers (CLI).
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runCli } from "../../../src/index.ts";
import {
  formatUpdateHelp,
  parseUpdateArgs,
} from "../../../src/modules/Update/services/runUpdate.ts";

export { formatUpdateHelp, parseUpdateArgs, runCli };

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-p6g-cli-"): TempProject {
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

export function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

export function writeLeafProject(cwd: string, name: string): void {
  writeText(
    join(cwd, "bapm.yml"),
    `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
  );
  writeText(
    join(cwd, "leaf", "apm.yml"),
    `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
  );
}

export function writeLeafLock(cwd: string): void {
  writeText(
    join(cwd, "bapm.lock.yaml"),
    `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n`,
  );
}

export function existingLockPath(cwd: string): string | undefined {
  for (const name of ["bapm.lock.yaml", "apm.lock.yaml"] as const) {
    const p = join(cwd, name);
    if (existsSync(p)) return p;
  }
  return undefined;
}

export function readBytes(path: string): Buffer {
  return readFileSync(path);
}

/** Fail if CLI treated the command as unknown (prevents false-green on exit≠0). */
export function expectKnownCommand(combined: string, command: string): void {
  if (/unknown command|not a (?:valid )?command|unrecognized command/i.test(combined)) {
    throw new Error(`CLI treated "${command}" as unknown command:\n${combined}`);
  }
}

export function expectKnownUpdateFlag(combined: string, flag: string): void {
  const escaped = flag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (
    new RegExp(`unknown update flag:\\s*${escaped}`, "i").test(combined) ||
    new RegExp(`unknown (?:flag|option):\\s*${escaped}`, "i").test(combined)
  ) {
    throw new Error(`CLI rejected "${flag}" as unknown flag:\n${combined}`);
  }
}

export function keepPlanPattern(): RegExp {
  return /\[=\].*\bkeep\b|\baction:\s*["']?keep["']?/i;
}

export function honestEmptyChangePattern(): RegExp {
  return /no dependency changes|nothing to (?:update|change)|up to date|no updates?/i;
}
