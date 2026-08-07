/**
 * Acceptance helpers for mcp-bake-directive (CLI Cursor install bake).
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../../../src/index.ts";

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-mcp-bake-directive-cli-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
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
  const { result, stdout, stderr } = await withCwd(cwd, () => withCapturedIo(() => runCli(argv)));
  return {
    result,
    stdout,
    stderr,
    combined: [...stdout, ...stderr].join("\n"),
  };
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
    withCursorDir?: boolean;
  },
): void {
  const name = options.name ?? "mcp-bake-directive-direct";
  const serverName = options.serverName ?? "bake-stdio-server";
  if (options.withCursorDir !== false) {
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
  }

  writeFileSync(
    join(cwd, "bapm.yml"),
    `name: ${name}
version: 0.0.1
dependencies:
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
