/**
 * CLI helpers for `bapm view` behavioural suite (promoted from cli-view-local-package).
 */
import * as core from "@bapm/core";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runCli } from "../../src/index.ts";

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-view-cli-"): TempProject {
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

export const VIEW_OK_LOCK = `lockfile_version: "1"
dependencies:
  - name: org/parent
    repo_url: https://example.com/org/parent.git
    source: git
    version: "1.0.0"
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  - name: acme/shared-utils
    repo_url: https://example.com/acme-org/shared-utils.git
    source: git
    version: "2.1.0"
    resolved_tag: v2.1.0
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    resolved_by:
      - org/parent
`;

export function writeViewOkLock(cwd: string): void {
  writeLock(cwd, VIEW_OK_LOCK);
}

export function writeInstalledSharedUtilsTree(cwd: string, description?: string): string {
  const normalize =
    (core as Record<string, unknown>).normalizeRepoIdentity ??
    (core as Record<string, unknown>).toLockRepoUrl;
  const toDir = (core as Record<string, unknown>).identityToCacheDir;
  if (typeof normalize !== "function" || typeof toDir !== "function") {
    throw new TypeError("expected @bapm/core identity helpers for modules fixture");
  }
  const repo = "https://example.com/acme-org/shared-utils.git";
  const identity = String((normalize as (r: string) => string)(repo));
  const dir = String((toDir as (id: string) => string)(identity));
  const tree = join(cwd, "apm_modules", dir, "bbbbbbbbbbbb");
  const descLine = description ? `description: ${description}\n` : "";
  writeText(
    join(tree, "apm.yml"),
    `name: acme/shared-utils\nversion: 2.1.0\n${descLine}`,
  );
  writeText(join(tree, "marker.txt"), "shared-utils\n");
  return tree;
}

/** Fail if CLI treated the command as unknown (prevents false-green on exit≠0). */
export function expectKnownCommand(combined: string, command: string): void {
  if (/unknown command|not a (?:valid )?command|unrecognized command/i.test(combined)) {
    throw new Error(`CLI treated "${command}" as unknown command:\n${combined}`);
  }
}

export { join, runCli };
