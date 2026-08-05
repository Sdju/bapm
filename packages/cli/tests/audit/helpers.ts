/**
 * CLI audit format / integrity test helpers (p6b).
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runCli } from "../../src/index.ts";

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-p6b-cli-"): TempProject {
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

export function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

export function sha256Hex(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function writeEmptyDepsProject(cwd: string, name: string): void {
  writeText(
    join(cwd, "bapm.yml"),
    `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
  );
}

export function writeCleanAuditProject(cwd: string, name: string): void {
  writeEmptyDepsProject(cwd, name);
  const rel = ".agents/skills/hello/SKILL.md";
  const content = "---\nname: hello\n---\n# Hi\n";
  writeText(join(cwd, rel), content);
  writeText(
    join(cwd, "bapm.lock.yaml"),
    `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n    deployed_file_hashes:\n      "${rel}": "${sha256Hex(content)}"\n`,
  );
}

export function writeTamperedAuditProject(cwd: string, name: string): void {
  writeEmptyDepsProject(cwd, name);
  const rel = ".agents/skills/hello/SKILL.md";
  writeText(join(cwd, rel), "TAMPERED\n");
  writeText(
    join(cwd, "bapm.lock.yaml"),
    `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n    deployed_file_hashes:\n      "${rel}": "${sha256Hex("good\n")}"\n`,
  );
}

export function writeMissingTreeAuditProject(cwd: string, name: string): void {
  writeEmptyDepsProject(cwd, name);
  const rel = ".agents/skills/hello/SKILL.md";
  const content = "ok\n";
  writeText(join(cwd, rel), content);
  writeText(
    join(cwd, "bapm.lock.yaml"),
    `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/git-pkg\n    name: git-pkg\n    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"\n    deployed_file_hashes:\n      "${rel}": "${sha256Hex(content)}"\n`,
  );
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

export function expectKnownCommand(combined: string, command: string): void {
  if (/unknown command|not a (?:valid )?command|unrecognized command/i.test(combined)) {
    throw new Error(`CLI treated "${command}" as unknown command:\n${combined}`);
  }
}

export { existsSync, readFileSync, join };
