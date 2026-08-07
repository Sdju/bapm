/**
 * CLI helpers for marketplace search/install suite.
 * Isolates HOME so ~/.bapm never touches the real user config.
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
import { runCli } from "../../src/index.ts";

export type IsolatedEnv = {
  home: string;
  cwd: string;
  cleanup: () => void;
};

export function createIsolatedEnv(prefix = "bapm-mp-si-cli-"): IsolatedEnv {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const home = join(root, "home");
  const cwd = join(root, "cwd");
  mkdirSync(home, { recursive: true });
  mkdirSync(cwd, { recursive: true });
  return {
    home,
    cwd,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
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

export async function withHomeAndCwd<T>(
  home: string,
  cwd: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prevHome = process.env.HOME;
  const prevCi = process.env.CI;
  const prevCwd = process.cwd();
  process.env.HOME = home;
  delete process.env.CI;
  process.chdir(cwd);
  try {
    return await fn();
  } finally {
    process.chdir(prevCwd);
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCi === undefined) delete process.env.CI;
    else process.env.CI = prevCi;
  }
}

export async function runInEnv(
  env: IsolatedEnv,
  argv: string[],
): Promise<{ result: number; stdout: string[]; stderr: string[]; combined: string }> {
  const { result, stdout, stderr } = await withHomeAndCwd(env.home, env.cwd, () =>
    withCapturedIo(() => runCli(argv)),
  );
  return {
    result,
    stdout,
    stderr,
    combined: [...stdout, ...stderr].join("\n"),
  };
}

export function writeText(cwd: string, relative: string, contents: string): string {
  const path = join(cwd, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
  return path;
}

export function writeLocalMarketplace(
  env: IsolatedEnv,
  options?: {
    alias?: string;
    pluginName?: string;
    description?: string;
    extraPlugins?: Array<{ name: string; description: string }>;
  },
): { alias: string; pluginName: string; marketplaceRoot: string } {
  const alias = options?.alias ?? "local-mp";
  const pluginName = options?.pluginName ?? "demo";
  const marketplaceRoot = join(env.cwd, "marketplaces", alias);
  const plugins = [
    {
      name: pluginName,
      description: options?.description ?? "Demo plugin for search/install",
      source: `./plugins/${pluginName}`,
      version: "1.0.0",
      tags: ["demo", "acceptance"],
    },
    ...(options?.extraPlugins ?? []).map((p) => ({
      name: p.name,
      description: p.description,
      source: `./plugins/${p.name}`,
      version: "0.0.1",
      tags: ["extra"],
    })),
  ];

  writeText(
    env.cwd,
    `marketplaces/${alias}/marketplace.json`,
    `${JSON.stringify({ name: alias, plugins }, null, 2)}\n`,
  );

  for (const p of plugins) {
    writeText(
      env.cwd,
      `marketplaces/${alias}/plugins/${p.name}/apm.yml`,
      `name: ${p.name}\nversion: 1.0.0\ndependencies:\n  apm: []\n`,
    );
    writeText(
      env.cwd,
      `marketplaces/${alias}/plugins/${p.name}/.apm/skills/hello/SKILL.md`,
      `---\nname: hello-${p.name}\n---\n# Hello ${p.name}\n`,
    );
  }

  return { alias, pluginName, marketplaceRoot };
}

export async function addMarketplace(
  env: IsolatedEnv,
  marketplaceRoot: string,
  alias: string,
): Promise<{ result: number; combined: string }> {
  return runInEnv(env, ["marketplace", "add", marketplaceRoot, "--name", alias]);
}

export function writeEmptyProject(cwd: string, name = "consumer"): void {
  writeText(cwd, "bapm.yml", `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm: []\n`);
}

export function readLockText(cwd: string): string {
  for (const name of ["bapm.lock.yaml", "apm.lock.yaml"] as const) {
    const p = join(cwd, name);
    if (existsSync(p)) return readFileSync(p, "utf8");
  }
  throw new Error("expected lockfile after install");
}

export function hasModules(cwd: string): boolean {
  for (const name of ["apm_modules", "bapm_modules"] as const) {
    const abs = join(cwd, name);
    if (!existsSync(abs)) continue;
    if (listFilesRecursive(abs).length > 0) return true;
  }
  return false;
}

function listFilesRecursive(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else out.push(abs);
    }
  };
  walk(root);
  return out;
}

export function expectKnownCommand(combined: string, command: string): void {
  if (/unknown command|not a (?:valid )?command|unrecognized command/i.test(combined)) {
    throw new Error(`CLI treated "${command}" as unknown command:\n${combined}`);
  }
}

export { existsSync, join, runCli };
