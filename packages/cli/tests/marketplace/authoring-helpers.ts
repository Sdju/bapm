/**
 * CLI helpers for marketplace authoring (bapm.yml) suite.
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

export type TempProject = { cwd: string; root: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-mp-authoring-cli-"): TempProject {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const cwd = join(root, "project");
  mkdirSync(cwd, { recursive: true });
  return {
    root,
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

/** Fail if CLI treated the command as unknown (prevents false-green on exit≠0). */
export function expectKnownCommand(combined: string, command: string): void {
  if (/unknown command|not a (?:valid )?command|unrecognized command/i.test(combined)) {
    throw new Error(`CLI treated "${command}" as unknown command:\n${combined}`);
  }
}

/** Fail if marketplace treated the subcommand as unknown. */
export function expectKnownMarketplaceSub(combined: string, sub: string): void {
  expectKnownCommand(combined, "marketplace");
  if (
    new RegExp(
      `unknown marketplace subcommand ['"]?${sub}|unknown subcommand ['"]?${sub}|not supported.*${sub}`,
      "i",
    ).test(combined)
  ) {
    throw new Error(`CLI treated marketplace "${sub}" as unknown subcommand:\n${combined}`);
  }
}

export function writeText(cwd: string, relative: string, contents: string): string {
  const path = join(cwd, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
  return path;
}

export function readText(cwd: string, relative: string): string {
  return readFileSync(join(cwd, relative), "utf8");
}

export function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

export function hasHostMarketplaceJsonEmit(cwd: string): boolean {
  const markers = [
    join(cwd, ".claude-plugin", "marketplace.json"),
    join(cwd, ".agents", "plugins", "marketplace.json"),
  ];
  return markers.some((p) => existsSync(p));
}

export function validAuthoringStub(): string {
  return [
    `name: acme`,
    `version: "0.1.0"`,
    `marketplace:`,
    `  owner: acme-org`,
    `  build:`,
    `    tagPattern: "v*"`,
    `  outputs:`,
    `    claude: true`,
    `  packages:`,
    `    - name: demo`,
    `      source: ./plugins/demo`,
    ``,
  ].join("\n");
}

export { existsSync, join, runCli };
