/**
 * CLI helpers for Marketplace consumer-registry suite.
 * Isolates HOME so ~/.bapm never touches the real user config.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runCli } from "../../src/index.ts";

export type IsolatedHome = {
  home: string;
  cwd: string;
  cleanup: () => void;
};

export function createIsolatedHome(prefix = "bapm-mp-cli-"): IsolatedHome {
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
  const prevCwd = process.cwd();
  process.env.HOME = home;
  process.chdir(cwd);
  try {
    return await fn();
  } finally {
    process.chdir(prevCwd);
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
  }
}

export async function runMarketplace(
  env: IsolatedHome,
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

export function bapmDir(home: string): string {
  return join(home, ".bapm");
}

export function marketplacesJsonPath(home: string): string {
  return join(home, ".bapm", "marketplaces.json");
}

export function readMarketplaces(home: string): { marketplaces: unknown[] } {
  const path = marketplacesJsonPath(home);
  if (!existsSync(path)) return { marketplaces: [] };
  return JSON.parse(readFileSync(path, "utf8")) as { marketplaces: unknown[] };
}

export function writeLocalFixture(cwd: string, relativePath: string, body: string): string {
  const file = join(cwd, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body, "utf8");
  return file;
}

export const LOCAL_FIXTURE = `{
  "name": "local-fixture",
  "plugins": [
    {
      "name": "demo-plugin",
      "description": "Demo plugin",
      "source": "./plugins/demo",
      "version": "0.1.0"
    }
  ]
}
`;

export const DUP_FIXTURE = `{
  "name": "dup-fixture",
  "plugins": [
    { "name": "Alpha", "source": "./a" },
    { "name": "alpha", "source": "./b" }
  ]
}
`;

/** Fail loudly if CLI treated marketplace as unknown top-level command. */
export function expectMarketplaceKnown(combined: string): void {
  if (/unknown command|not a (?:valid )?command|unrecognized command/i.test(combined)) {
    throw new Error(`CLI treated "marketplace" as unknown command:\n${combined}`);
  }
}

/** Snapshot + restore selected env keys around a test body. */
export async function withEnv<T>(
  patch: Record<string, string | undefined>,
  fn: () => Promise<T> | T,
): Promise<T> {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(patch)) {
    prev[key] = process.env[key];
    const next = patch[key];
    if (next === undefined) delete process.env[key];
    else process.env[key] = next;
  }
  try {
    return await fn();
  } finally {
    for (const key of Object.keys(patch)) {
      const v = prev[key];
      if (v === undefined) delete process.env[key];
      else process.env[key] = v;
    }
  }
}

/** Minimal marketplace.json for hosts-auth CLI unlock probes. */
export const FIXTURE_MP = `{
  "name": "hosts-auth-cli-mp",
  "plugins": [
    { "name": "demo-plugin", "description": "Demo", "source": "./plugins/demo", "version": "1.0.0" }
  ]
}`;
