/**
 * Acceptance helpers for manifest-env-bake (CLI Cursor install bake).
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../../../src/index.ts";

export type TempProject = { cwd: string; cleanup: () => void };

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGES_ROOT = join(HERE, "../../../..");

export function createTempProject(prefix = "bapm-manifest-env-bake-cli-"): TempProject {
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

function cursorMapYaml(spec: string): string {
  return `targets:\n  cursor: "${spec}"\n`;
}

async function withCapturedIo<T>(
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

async function withCwd<T>(cwd: string, fn: () => Promise<T>): Promise<T> {
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
  const savedCi = process.env.CI;
  delete process.env.CI;
  try {
    const { result, stdout, stderr } = await withCwd(cwd, () => withCapturedIo(() => runCli(argv)));
    return {
      result,
      stdout,
      stderr,
      combined: [...stdout, ...stderr].join("\n"),
    };
  } finally {
    if (savedCi === undefined) delete process.env.CI;
    else process.env.CI = savedCi;
  }
}

/** Fail if CLI rejected argv as unknown flag (prevents false-green on exit≠0). */
export function expectKnownFlags(combined: string): void {
  if (/unknown (?:install )?(?:flag|option)|unrecognized/i.test(combined)) {
    throw new Error(`CLI rejected argv as unknown flag:\n${combined}`);
  }
}

export function mcpJsonPath(cwd: string): string {
  return join(cwd, ".cursor", "mcp.json");
}

export function readMcpServers(cwd: string): Record<string, unknown> {
  const path = mcpJsonPath(cwd);
  if (!existsSync(path)) return {};
  const raw = JSON.parse(readFileSync(path, "utf8")) as { mcpServers?: Record<string, unknown> };
  return raw.mcpServers ?? {};
}

export function readMcpJsonRaw(cwd: string): string | undefined {
  const path = mcpJsonPath(cwd);
  if (!existsSync(path)) return undefined;
  return readFileSync(path, "utf8");
}

export function writeDirectMcpEnvProject(
  cwd: string,
  options: {
    name?: string;
    serverName?: string;
    envYaml: string;
    /** Top-level bapm.yml `env:` block body (indented under `env:`). */
    manifestEnvYaml?: string;
    withCursorDir?: boolean;
  },
): void {
  const name = options.name ?? "manifest-env-bake-direct";
  const serverName = options.serverName ?? "bake-stdio-server";
  if (options.withCursorDir !== false) {
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
  }

  const topEnv = options.manifestEnvYaml !== undefined ? `env:\n${options.manifestEnvYaml}` : "";

  writeFileSync(
    join(cwd, "bapm.yml"),
    `name: ${name}
version: 0.0.1
${cursorMapYaml(linkCursorIntegration(cwd))}${topEnv}dependencies:
  apm: []
  mcp:
    - name: ${serverName}
      registry: false
      transport: stdio
      command: echo
      args: ["--ok"]
      env:
${options.envYaml}
`,
    "utf8",
  );
}
