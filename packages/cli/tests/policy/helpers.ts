/**
 * CLI policy suite helpers (install gate + policy status).
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../../src/index.ts";

export type TempProject = { cwd: string; cleanup: () => void };

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGES_ROOT = join(HERE, "../../..");

export function createTempProject(prefix = "bapm-policy-cli-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

export function linkPackageDir(projectCwd: string, packageRoot: string): string {
  const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
    name: string;
  };
  const name = pkg.name;
  const dest = join(projectCwd, "node_modules", ...name.split("/"));
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  symlinkSync(packageRoot, dest, "dir");
  return name;
}

export function linkCursorIntegration(projectCwd: string): string {
  return linkPackageDir(projectCwd, join(PACKAGES_ROOT, "integration-cursor"));
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

export function writeLeafProject(cwd: string, name: string): void {
  mkdirSync(join(cwd, "leaf"), { recursive: true });
  mkdirSync(join(cwd, ".cursor"), { recursive: true });
  const spec = linkCursorIntegration(cwd);
  writeFileSync(
    join(cwd, "bapm.yml"),
    `name: ${name}\nversion: 0.0.1\ntargets:\n  cursor: "${spec}"\ndependencies:\n  apm:\n    - path: ./leaf\n`,
    "utf8",
  );
  writeFileSync(
    join(cwd, "leaf", "apm.yml"),
    `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    "utf8",
  );
}

export function writePolicy(
  cwd: string,
  filename: "apm-policy.yml" | "bapm-policy.yml" | string,
  contents: string,
): string {
  const path = join(cwd, filename);
  writeFileSync(path, contents, "utf8");
  return path;
}

export const BLOCK_DENY_LEAF = `name: deny-leaf
enforcement: block
dependencies:
  deny:
    - leaf
`;

export const WARN_DENY_LEAF = `name: warn-deny-leaf
enforcement: warn
dependencies:
  deny:
    - leaf
`;

export const MINIMAL_WARN = `name: org
enforcement: warn
`;

export const RICH_LOCAL = `name: rich-local
enforcement: block
dependencies:
  allow:
    - safe/*
  deny:
    - evil/*
    - bad/actor
  require:
    - org/baseline
  max_depth: 3
  require_pinned_constraint: true
`;

export function hasModules(cwd: string): boolean {
  const dir = join(cwd, "apm_modules");
  return existsSync(dir);
}

export function hasLock(cwd: string): boolean {
  return existsSync(join(cwd, "bapm.lock.yaml")) || existsSync(join(cwd, "apm.lock.yaml"));
}

/** Fail if CLI rejected argv as unknown flag (prevents false-green on exit≠0). */
export function expectKnownInstallFlags(combined: string): void {
  if (/unknown install (?:flag|option)|unknown (?:option|flag)|unrecognized/i.test(combined)) {
    throw new Error(`CLI rejected install argv as unknown flag:\n${combined}`);
  }
}

/** Fail loudly if CLI rejected the command group as unknown. */
export function expectKnownCommand(combined: string, command: string): void {
  if (/unknown command|not a (?:valid )?command|unrecognized command/i.test(combined)) {
    throw new Error(`CLI treated "${command}" as unknown command:\n${combined}`);
  }
}

export function parseJsonStdout(stdout: string[]): Record<string, unknown> {
  const body = stdoutText(stdout).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error(`expected JSON object on stdout:\n${body}`);
  }
  return JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>;
}

function fingerprintTree(root: string): string {
  const parts: string[] = [];
  const walk = (dir: string, rel = ""): void => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      const childRel = rel ? `${rel}/${name}` : name;
      const st = statSync(full);
      if (st.isDirectory()) walk(full, childRel);
      else {
        const body = readFileSync(full);
        parts.push(`${childRel}:${st.size}:${createHash("sha256").update(body).digest("hex")}`);
      }
    }
  };
  if (existsSync(root)) walk(root);
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

export function projectFingerprint(cwd: string): string {
  const keys = [
    "bapm.yml",
    "apm.yml",
    "bapm.lock.yaml",
    "apm.lock.yaml",
    "apm_modules",
    "bapm_modules",
  ];
  const parts: string[] = [];
  for (const key of keys) {
    const full = join(cwd, key);
    if (!existsSync(full)) continue;
    const st = statSync(full);
    if (st.isDirectory()) parts.push(`${key}:dir:${fingerprintTree(full)}`);
    else {
      const body = readFileSync(full);
      parts.push(`${key}:file:${createHash("sha256").update(body).digest("hex")}`);
    }
  }
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

export { join, runCli };
