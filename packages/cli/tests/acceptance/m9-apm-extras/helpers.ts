/**
 * CLI M9 APM extras acceptance helpers.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../../../src/index.ts";

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-m9-cli-"): TempProject {
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

export function hasLock(cwd: string): boolean {
  return existsSync(join(cwd, "bapm.lock.yaml")) || existsSync(join(cwd, "apm.lock.yaml"));
}

export function readLockText(cwd: string): string {
  const path = existsSync(join(cwd, "bapm.lock.yaml"))
    ? join(cwd, "bapm.lock.yaml")
    : join(cwd, "apm.lock.yaml");
  return readFileSync(path, "utf8");
}

const STDIO_MCP = `    - name: test-stdio-server
      registry: false
      transport: stdio
      command: echo
      args: ["--greeting", "hello"]
`;

/** Consumer with direct dependencies.mcp stdio server; optional .cursor / grants. */
export function writeDirectMcpProject(
  cwd: string,
  options?: {
    name?: string;
    withCursorDir?: boolean;
    grantSurface?: "none" | "empty-allow" | "allow-self";
    aliasAllowExecutables?: boolean;
  },
): void {
  const name = options?.name ?? "m9-direct-mcp";
  if (options?.withCursorDir !== false) {
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
  }

  let grants = "";
  if (options?.grantSurface === "empty-allow") {
    grants = options.aliasAllowExecutables
      ? `allowExecutables: {}\n`
      : `executables:\n  allow: {}\n`;
  } else if (options?.grantSurface === "allow-self") {
    // Root-authored MCP is unaffected by sc-009; grant surface still present.
    grants = `executables:\n  allow:\n    ${name}:\n      mcp: true\n`;
  }

  writeFileSync(
    join(cwd, "bapm.yml"),
    `name: ${name}\nversion: 0.0.1\n${grants}dependencies:\n  apm: []\n  mcp:\n${STDIO_MCP}`,
    "utf8",
  );
}

/**
 * Consumer path-deps on `./mcp-dep` which declares MCP (+ optional skill).
 * Grant surface on consumer gates dependency MCP (sc-009).
 */
export function writeDepMcpProject(
  cwd: string,
  options?: {
    name?: string;
    approveDep?: boolean;
    aliasAllowExecutables?: boolean;
    withSkill?: boolean;
  },
): void {
  const name = options?.name ?? "m9-dep-mcp";
  mkdirSync(join(cwd, ".cursor"), { recursive: true });
  mkdirSync(join(cwd, "mcp-dep"), { recursive: true });

  let grants: string;
  if (options?.approveDep) {
    if (options.aliasAllowExecutables) {
      grants = `allowExecutables:\n  mcp-dep:\n    mcp: true\n`;
    } else {
      grants = `executables:\n  allow:\n    mcp-dep:\n      mcp: true\n`;
    }
  } else {
    // Non-absent grant surface with no approval for mcp-dep → fail-closed.
    grants = options?.aliasAllowExecutables
      ? `allowExecutables: {}\n`
      : `executables:\n  allow: {}\n`;
  }

  writeFileSync(
    join(cwd, "bapm.yml"),
    `name: ${name}\nversion: 0.0.1\n${grants}dependencies:\n  apm:\n    - path: ./mcp-dep\n`,
    "utf8",
  );

  writeFileSync(
    join(cwd, "mcp-dep", "apm.yml"),
    `name: mcp-dep\nversion: 0.0.1\ndependencies:\n  apm: []\n  mcp:\n${STDIO_MCP}`,
    "utf8",
  );

  if (options?.withSkill !== false) {
    mkdirSync(join(cwd, "mcp-dep", ".apm", "skills", "hello"), { recursive: true });
    writeFileSync(
      join(cwd, "mcp-dep", ".apm", "skills", "hello", "SKILL.md"),
      "---\nname: hello\n---\n# Hello\n",
      "utf8",
    );
  }
}

export function writeCompileProject(cwd: string, name = "m9-compile"): void {
  mkdirSync(join(cwd, ".cursor"), { recursive: true });
  mkdirSync(join(cwd, ".apm", "instructions"), { recursive: true });
  writeFileSync(
    join(cwd, "bapm.yml"),
    `name: ${name}\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm: []\n`,
    "utf8",
  );
  writeFileSync(
    join(cwd, ".apm", "instructions", "style.md"),
    "# Style\nPrefer concise answers.\n",
    "utf8",
  );
}

export function writeModulesCacheProject(cwd: string, name = "m9-cache"): void {
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
