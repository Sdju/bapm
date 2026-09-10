/**
 * CLI helpers for pack --check-versions suites.
 * Specs: producer-pack-check-versions, producer-pack-archive.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runCli } from "../../src/index.ts";
import { formatPackHelp, parsePackArgs } from "../../src/modules/Pack/services/runPack.ts";

export { formatPackHelp, parsePackArgs, runCli };

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-cli-check-versions-"): TempProject {
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

/** Fail if CLI treated the command as unknown (prevents false-green on exit≠0). */
export function expectKnownCommand(combined: string, command: string): void {
  if (/unknown command|not a (?:valid )?command|unrecognized command/i.test(combined)) {
    throw new Error(`CLI treated "${command}" as unknown command:\n${combined}`);
  }
}

/** Gate must accept --check-versions (not reject as unknown pack flag). */
export function expectCheckVersionsKnown(combined: string): void {
  if (/Unknown pack flag:\s*--check-versions/i.test(combined)) {
    throw new Error(`pack still rejects --check-versions as unknown:\n${combined}`);
  }
}

export function writeText(cwd: string, relative: string, contents: string): string {
  const path = join(cwd, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
  return path;
}

export function findZipUnder(cwd: string): string | undefined {
  if (!existsSync(cwd)) return undefined;
  for (const name of readdirSync(cwd)) {
    const p = join(cwd, name);
    if (statSync(p).isFile() && name.endsWith(".zip")) return p;
  }
  return undefined;
}

export function writeConformingManifest(
  cwd: string,
  options?: { name?: string; version?: string },
): void {
  const name = options?.name ?? "cli-pack";
  const version = options?.version ?? "1.2.3";
  writeText(
    cwd,
    "bapm.yml",
    `name: ${name}\nversion: "${version}"\ndependencies:\n  apm: []\n  mcp: []\n`,
  );
}

export type MarketplaceFixtureOpts = {
  name?: string;
  projectVersion?: string;
  marketVersion?: string;
  strategy?: "lockstep" | "tag_pattern" | "per_package";
  buildTagPattern?: string;
  packages?: Array<{ name: string; source: string }>;
};

/** Root bapm.yml with marketplace: block for version-alignment fixtures. */
export function writeMarketplaceProject(cwd: string, opts: MarketplaceFixtureOpts = {}): void {
  const name = opts.name ?? "monorepo";
  const projectVersion = opts.projectVersion ?? "1.0.0";
  const marketVersion = opts.marketVersion ?? projectVersion;
  const packages = opts.packages ?? [{ name: "demo", source: "./plugins/demo" }];
  const lines: string[] = [
    `name: ${name}`,
    `version: "${projectVersion}"`,
    `marketplace:`,
    `  name: acme-tools`,
    `  version: "${marketVersion}"`,
    `  owner: acme-org`,
  ];
  if (opts.strategy) {
    lines.push(`  versioning:`, `    strategy: ${opts.strategy}`);
  }
  if (opts.buildTagPattern) {
    lines.push(`  build:`, `    tagPattern: "${opts.buildTagPattern}"`);
  }
  lines.push(`  packages:`);
  for (const pkg of packages) {
    lines.push(`    - name: ${pkg.name}`, `      source: ${pkg.source}`);
  }
  lines.push(``);
  writeText(cwd, "bapm.yml", lines.join("\n"));
}

export function writePluginPackage(
  cwd: string,
  rel: string,
  version: string | null | undefined,
): void {
  const manifest: Record<string, string> = { name: "plugin" };
  if (version !== null && version !== undefined) {
    manifest.version = version;
  }
  writeText(cwd, join(rel, "plugin.json"), `${JSON.stringify(manifest)}\n`);
}

export function writeYamlPackage(
  cwd: string,
  rel: string,
  version: string | null,
  filename: "apm.yml" | "bapm.yml" = "apm.yml",
): void {
  const body =
    version === null
      ? `name: pkg\ndescription: "no version"\n`
      : `name: pkg\ndescription: "x"\nversion: "${version}"\n`;
  writeText(cwd, join(rel, filename), body);
}

export function checkVersionsOf(parsed: Record<string, unknown>): boolean {
  return Boolean(parsed.checkVersions ?? parsed.check_versions ?? parsed.checkVersionAlignment);
}
