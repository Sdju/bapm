/**
 * CLI lifecycle test helpers — capture IO, temp projects, assert known commands.
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
import { createHash } from "node:crypto";
import { runCli } from "../../src/index.ts";
import {
  formatDoctorHelp,
  parseDoctorArgs,
} from "../../src/modules/Doctor/services/runDoctor.ts";
import {
  formatOutdatedHelp,
  parseOutdatedArgs,
} from "../../src/modules/Outdated/services/runOutdated.ts";
import {
  formatUpdateHelp,
  parseUpdateArgs,
} from "../../src/modules/Update/services/runUpdate.ts";

export {
  formatDoctorHelp,
  formatOutdatedHelp,
  formatUpdateHelp,
  parseDoctorArgs,
  parseOutdatedArgs,
  parseUpdateArgs,
  runCli,
};

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-m6-cli-"): TempProject {
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

export function writeLeafProject(cwd: string, name: string): void {
  mkdirSync(join(cwd, "leaf"), { recursive: true });
  writeFileSync(
    join(cwd, "bapm.yml"),
    `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
    "utf8",
  );
  writeFileSync(
    join(cwd, "leaf", "apm.yml"),
    `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    "utf8",
  );
}

export function writeEmptyDepsProject(cwd: string, name: string): void {
  writeFileSync(
    join(cwd, "bapm.yml"),
    `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    "utf8",
  );
}

export function writeLock(cwd: string, contents: string): void {
  writeFileSync(join(cwd, "bapm.lock.yaml"), contents, "utf8");
}

export function writeLeafLock(cwd: string): void {
  writeLock(
    cwd,
    `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n`,
  );
}

export function sha256Hex(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
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

export function expectKnownUpdateFlag(combined: string, flag: string): void {
  const escaped = flag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (
    new RegExp(`unknown update flag:\\s*${escaped}`, "i").test(combined) ||
    new RegExp(`unknown (?:flag|option):\\s*${escaped}`, "i").test(combined)
  ) {
    throw new Error(`CLI rejected "${flag}" as unknown flag:\n${combined}`);
  }
}

export function expectKnownOutdatedFlag(combined: string, flag: string): void {
  const escaped = flag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (
    new RegExp(`unknown outdated flag:\\s*${escaped}`, "i").test(combined) ||
    new RegExp(`unknown (?:flag|option):\\s*${escaped}`, "i").test(combined)
  ) {
    throw new Error(`CLI rejected "${flag}" as unknown flag:\n${combined}`);
  }
}

/** Fail if CLI rejected a doctor verbose flag as unknown (prevents false-green). */
export function expectKnownDoctorFlag(combined: string, flag: string): void {
  const escaped = flag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (
    new RegExp(`unknown doctor flag:\\s*${escaped}`, "i").test(combined) ||
    new RegExp(`unknown (?:flag|option):\\s*${escaped}`, "i").test(combined)
  ) {
    throw new Error(`CLI rejected "${flag}" as unknown flag:\n${combined}`);
  }
}

export function stdoutText(stdout: string[]): string {
  return stdout.join("\n");
}

export function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

/** Sane project: manifest + lock, no modules dir (absent ok). */
export function writeDoctorProject(cwd: string, name: string): void {
  writeText(
    join(cwd, "bapm.yml"),
    `name: ${name}\nversion: 1.2.3\ndependencies:\n  apm: []\n`,
  );
  writeText(
    join(cwd, "bapm.lock.yaml"),
    `lockfile_version: "1"
dependencies:
  - name: leaf
    repo_url: local:leaf
    source: local
    version: "0.0.1"
`,
  );
}

export function lineForCheck(text: string, name: string): string | undefined {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => new RegExp(`^(PASS|FAIL)\\t${name}\\t`).test(l));
}

export function projectFingerprintAll(cwd: string): string {
  const parts: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else {
        const rel = full.slice(cwd.length + 1);
        const bytes = readFileSync(full);
        parts.push(`${rel}:${createHash("sha256").update(bytes).digest("hex")}`);
      }
    }
  };
  if (existsSync(cwd)) walk(cwd);
  parts.sort();
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

export const MARKETPLACE_ROW_PATTERN =
  /marketplace|format.?coverage|duplicate.?name|version.?alignment|executable.?trust/i;

export function parseJsonStdout(stdout: string[]): unknown {
  const text = stdoutText(stdout).trim();
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `expected parseable JSON on stdout, got:\n${text}\n${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function keepPlanPattern(): RegExp {
  return /\[=\].*\bkeep\b|\baction:\s*["']?keep["']?/i;
}

export function honestEmptyChangePattern(): RegExp {
  return /no dependency changes|nothing to (?:update|change)|up to date|no updates?/i;
}
