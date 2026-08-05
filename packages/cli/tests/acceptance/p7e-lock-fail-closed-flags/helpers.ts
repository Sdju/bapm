/**
 * p7e-lock-fail-closed-flags acceptance helpers (CLI).
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
import { runCli } from "../../../src/index.ts";
import { formatLockHelp, parseLockArgs } from "../../../src/modules/Lock/services/runLock.ts";

export { formatLockHelp, parseLockArgs, runCli };

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-p7e-cli-"): TempProject {
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

export function writeSampleLock(cwd: string): string {
  const path = join(cwd, "bapm.lock.yaml");
  writeText(
    path,
    `lockfile_version: "1"
generated_at: "2024-06-01T12:00:00Z"
dependencies:
  - name: leaf
    repo_url: local:leaf
    source: local
    version: "0.0.1"
  - name: example-one
    repo_url: github.com/example/one
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
`,
  );
  return path;
}

export function lockPath(cwd: string): string | undefined {
  for (const name of ["bapm.lock.yaml", "apm.lock.yaml"] as const) {
    const p = join(cwd, name);
    if (existsSync(p)) return p;
  }
  return undefined;
}

export function readLockBytes(cwd: string): Buffer {
  const p = lockPath(cwd);
  if (!p) throw new Error("no lockfile");
  return readFileSync(p);
}

export function stdoutText(stdout: string[]): string {
  return stdout.join("\n");
}

export function listFilesRecursive(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(p.slice(root.length + 1));
    }
  };
  walk(root);
  return out.sort();
}

/** Fail if CLI treated lock as an unknown command. */
export function expectKnownCommand(combined: string): void {
  if (/unknown command|not a (?:valid )?command|unrecognized command/i.test(combined)) {
    throw new Error(`CLI treated "lock" as unknown command:\n${combined}`);
  }
}

/** Fail if a known P6c lock flag was rejected as unknown. */
export function expectKnownLockFlag(combined: string, flag: string): void {
  const escaped = flag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (
    new RegExp(`unknown lock flag:\\s*${escaped}`, "i").test(combined) ||
    new RegExp(`unknown (?:flag|option):\\s*${escaped}`, "i").test(combined)
  ) {
    throw new Error(`CLI rejected "${flag}" as unknown flag:\n${combined}`);
  }
}
