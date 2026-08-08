/**
 * CLI M9 APM extras acceptance helpers.
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
import { runCli } from "../../src/index.ts";

export type TempProject = { cwd: string; cleanup: () => void };

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGES_ROOT = join(HERE, "../../..");

export function createTempProject(prefix = "bapm-m9-cli-"): TempProject {
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
  env: Record<string, string | undefined> = {},
): Promise<{ result: number; stdout: string[]; stderr: string[]; combined: string }> {
  const keys = new Set(["CI", ...Object.keys(env)]);
  const saved: Record<string, string | undefined> = {};
  for (const k of keys) {
    saved[k] = process.env[k];
  }
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
    `name: ${name}\nversion: 0.0.1\n${cursorMapYaml(linkCursorIntegration(cwd))}${grants}dependencies:\n  apm: []\n  mcp:\n${STDIO_MCP}`,
    "utf8",
  );
}

/** Direct MCP stdio server with custom env YAML block (bake-time placeholders). */
export function writeDirectMcpEnvProject(
  cwd: string,
  options: {
    name?: string;
    serverName?: string;
    envYaml: string;
    withCursorDir?: boolean;
  },
): void {
  const name = options.name ?? "mcp-bake-direct";
  const serverName = options.serverName ?? "bake-stdio-server";
  if (options.withCursorDir !== false) {
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
  }

  writeFileSync(
    join(cwd, "bapm.yml"),
    `name: ${name}
version: 0.0.1
${cursorMapYaml(linkCursorIntegration(cwd))}dependencies:
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
    `name: ${name}\nversion: 0.0.1\n${cursorMapYaml(linkCursorIntegration(cwd))}${grants}dependencies:\n  apm:\n    - path: ./mcp-dep\n`,
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
  const spec = linkCursorIntegration(cwd);
  writeFileSync(
    join(cwd, "bapm.yml"),
    `name: ${name}\nversion: 0.0.1\ntargets:\n  cursor: "${spec}"\ndependencies:\n  apm: []\n`,
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
  mkdirSync(join(cwd, ".cursor"), { recursive: true });
  const spec = linkCursorIntegration(cwd);
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
