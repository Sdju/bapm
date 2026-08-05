/**
 * p7f-doctor-verbose acceptance helpers (CLI).
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
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runCli } from "../../../src/index.ts";
import {
  formatDoctorHelp,
  parseDoctorArgs,
} from "../../../src/modules/Doctor/services/runDoctor.ts";

export { formatDoctorHelp, parseDoctorArgs, runCli };

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-p7f-cli-"): TempProject {
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

export function expectKnownCommand(combined: string): void {
  if (/unknown command|not a (?:valid )?command|unrecognized command/i.test(combined)) {
    throw new Error(`CLI treated "doctor" as unknown command:\n${combined}`);
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

export function listRelativeFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else out.push(full.slice(root.length + 1));
    }
  };
  walk(root);
  return out.sort();
}

export function projectFingerprint(cwd: string): string {
  const parts = listRelativeFiles(cwd).map((rel) => {
    const bytes = readFileSync(join(cwd, rel));
    return `${rel}:${createHash("sha256").update(bytes).digest("hex")}`;
  });
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

export function lineForCheck(text: string, name: string): string | undefined {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => new RegExp(`^(PASS|FAIL)\\t${name}\\t`).test(l));
}

export const MARKETPLACE_ROW_PATTERN =
  /marketplace|format.?coverage|duplicate.?name|version.?alignment|executable.?trust/i;
