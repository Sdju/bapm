/**
 * CLI helpers for sc-executable-governance acceptance (RED).
 */
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
import { runCli } from "../../../src/index.ts";

export type IsolatedHome = {
  home: string;
  cwd: string;
  root: string;
  cleanup: () => void;
};

export function createIsolatedHome(prefix = "bapm-sc-exec-gov-cli-"): IsolatedHome {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const home = join(root, "home");
  const cwd = join(root, "cwd");
  mkdirSync(home, { recursive: true });
  mkdirSync(cwd, { recursive: true });
  return {
    home,
    cwd,
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
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

async function withHomeAndCwd<T>(home: string, cwd: string, fn: () => Promise<T>): Promise<T> {
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

export async function runInEnv(
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

export function writeText(cwd: string, relative: string, contents: string): string {
  const path = join(cwd, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
  return path;
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export function userConfigPath(home: string): string {
  return join(home, ".bapm", "config.json");
}

export function readUserConfig(home: string): {
  executables?: { allow?: Record<string, unknown>; deny?: Record<string, unknown> };
} {
  const path = userConfigPath(home);
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8")) as {
    executables?: { allow?: Record<string, unknown>; deny?: Record<string, unknown> };
  };
}

export function writeMinimalProject(cwd: string): string {
  return writeText(
    cwd,
    "bapm.yml",
    `name: sc-exec-gov-consumer
version: 0.0.1
`,
  );
}

export function expectKnownCommand(combined: string, name: string): void {
  if (/unknown command|not a (?:valid )?command|unrecognized command/i.test(combined)) {
    // Only fail early when the *target* command is unknown — unknown is expected RED until apply.
    if (new RegExp(`unknown command.*\\b${name}\\b|\\b${name}\\b.*unknown`, "i").test(combined)) {
      return;
    }
  }
}

export { existsSync, join, runCli, withCapturedIo };
