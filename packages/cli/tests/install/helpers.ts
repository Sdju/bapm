/**
 * Shared CLI install test helpers (temp project, env-isolated runCli).
 */
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
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../../src/index.ts";
import {
  parseInstallArgs,
  formatInstallHelp,
} from "../../src/modules/Install/services/runInstall.ts";

export { parseInstallArgs, formatInstallHelp, runCli };

export type TempProject = { cwd: string; cleanup: () => void };

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGES_ROOT = join(HERE, "../../..");

export function createTempProject(prefix = "bapm-cli-install-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

/** Symlink a workspace package directory into the project's node_modules. */
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

function cursorMapYaml(spec: string): string {
  return `targets:\n  cursor: "${spec}"\n`;
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

/**
 * Run CLI with an isolated env overlay. Always clears host `CI` unless the
 * overlay sets it — host CI=true must not leak into install tests.
 */
export async function runInProject(
  cwd: string,
  argv: string[],
  env: Record<string, string | undefined> = {},
): Promise<{ result: number; stdout: string[]; stderr: string[]; combined: string }> {
  const keys = new Set(["CI", ...Object.keys(env)]);
  const saved: Record<string, string | undefined> = {};
  for (const k of keys) {
    saved[k] = process.env[k];
  }
  // Default: unset CI so host runners do not freeze installs accidentally.
  delete process.env.CI;
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    const { result, stdout, stderr } = await withCwd(cwd, () => withCapturedIo(() => runCli(argv)));
    return {
      result,
      stdout,
      stderr,
      combined: [...stdout, ...stderr].join("\n"),
    };
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

export function expectKnownCommand(combined: string, command: string): void {
  if (/unknown command|not a (?:valid )?command|unrecognized command/i.test(combined)) {
    throw new Error(`CLI treated "${command}" as unknown command:\n${combined}`);
  }
}

export function expectKnownFlags(combined: string): void {
  if (/unknown (?:install )?(?:flag|option)|unrecognized/i.test(combined)) {
    throw new Error(`CLI rejected argv as unknown flag:\n${combined}`);
  }
}

export function writeLeafProject(
  cwd: string,
  name: string,
  options?: { withCursor?: boolean },
): void {
  mkdirSync(join(cwd, "leaf"), { recursive: true });
  const spec = linkCursorIntegration(cwd);
  if (options?.withCursor) {
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
  }
  writeFileSync(
    join(cwd, "bapm.yml"),
    `name: ${name}\nversion: 0.0.1\n${cursorMapYaml(spec)}dependencies:\n  apm:\n    - path: ./leaf\n`,
    "utf8",
  );
  writeFileSync(
    join(cwd, "leaf", "apm.yml"),
    `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    "utf8",
  );
}

export function writeMcpProject(cwd: string, name: string): void {
  mkdirSync(join(cwd, ".cursor"), { recursive: true });
  mkdirSync(join(cwd, "leaf"), { recursive: true });
  const spec = linkCursorIntegration(cwd);
  writeFileSync(
    join(cwd, "bapm.yml"),
    `name: ${name}
version: 0.0.1
${cursorMapYaml(spec)}dependencies:
  apm:
    - path: ./leaf
  mcp:
    - name: test-stdio-server
      registry: false
      transport: stdio
      command: echo
      args: ["--greeting", "hello"]
`,
    "utf8",
  );
  writeFileSync(
    join(cwd, "leaf", "apm.yml"),
    `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    "utf8",
  );
  writeText(cwd, "leaf/.apm/skills/hello/SKILL.md", "---\nname: hello\n---\n# Hello\n");
}

export function writePolicy(cwd: string, contents: string): string {
  const path = join(cwd, "bapm-policy.yml");
  writeFileSync(path, contents, "utf8");
  return path;
}

export const BLOCK_DENY_LEAF = `name: deny-leaf
enforcement: block
dependencies:
  deny:
    - leaf
`;

export function hasLockfile(cwd: string): boolean {
  return existsSync(join(cwd, "bapm.lock.yaml")) || existsSync(join(cwd, "apm.lock.yaml"));
}

export function hasModules(cwd: string): boolean {
  for (const name of ["apm_modules", "bapm_modules"] as const) {
    const abs = join(cwd, name);
    if (!existsSync(abs)) continue;
    if (listFilesRecursive(abs).length > 0) return true;
  }
  return false;
}

export function readManifestText(cwd: string): string {
  const path = existsSync(join(cwd, "bapm.yml")) ? join(cwd, "bapm.yml") : join(cwd, "apm.yml");
  return readFileSync(path, "utf8");
}

export function mcpJsonPath(cwd: string): string {
  return join(cwd, ".cursor", "mcp.json");
}

export function writeText(cwd: string, relative: string, contents: string): void {
  const path = join(cwd, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

/** Content fingerprint of durable project paths (atime ignored). */
export function fingerprintProject(cwd: string): string {
  const roots = [
    "bapm.yml",
    "apm.yml",
    "bapm.lock.yaml",
    "apm.lock.yaml",
    "apm_modules",
    "bapm_modules",
    ".cursor",
    ".agents",
  ];
  const entries: string[] = [];
  for (const root of roots) {
    const abs = join(cwd, root);
    if (!existsSync(abs)) continue;
    const st = statSync(abs);
    if (st.isFile()) {
      entries.push(`${root}:${hash(readFileSync(abs))}`);
      continue;
    }
    for (const rel of listFilesRecursive(abs)) {
      entries.push(`${root}/${rel}:${hash(readFileSync(join(abs, rel)))}`);
    }
  }
  entries.sort();
  return createHash("sha256").update(entries.join("\n"), "utf8").digest("hex");
}

function hash(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function listFilesRecursive(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (statSync(abs).isDirectory()) walk(abs, rel);
      else out.push(rel.replaceAll("\\", "/"));
    }
  };
  walk(root, "");
  return out.sort();
}
