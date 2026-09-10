/**
 * Core helpers for pack-check-versions-plugin-json acceptance (RED → GREEN).
 * Soft-resolve version-alignment + authoring APIs from @b-apm/core.
 * Specs: producer-pack-check-versions, marketplace-authoring-schema.
 */
import * as core from "@b-apm/core";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

type AnyFn = (...args: never[]) => unknown;

export function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @b-apm/core to export one of [${names.join(", ")}] (${label})`);
}

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-core-check-versions-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

export function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

export function writeBapmYml(cwd: string, body: string): string {
  const path = join(cwd, "bapm.yml");
  writeText(path, body);
  return path;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  throw new TypeError(`expected object, got ${typeof value}`);
}

/** Load marketplace authoring from bapm.yml. */
export function getLoadMarketplaceFromBapmYml(): (input: {
  cwd?: string;
  path?: string;
}) => unknown {
  return pickExport(
    [
      "loadMarketplaceFromBapmYml",
      "loadMarketplaceAuthoringFromBapmYml",
      "loadAuthoringMarketplace",
    ],
    "load marketplace authoring from bapm.yml",
  ) as (input: { cwd?: string; path?: string }) => unknown;
}

/** Core marketplace version-alignment gate (distinct from checkReleaseTag). */
export function getCheckVersionAlignment(): (
  opts: Record<string, unknown>,
) => unknown | Promise<unknown> {
  return pickExport(
    [
      "checkVersionAlignment",
      "checkMarketplaceVersionAlignment",
      "runVersionAlignmentCheck",
      "checkVersions",
    ],
    "marketplace version-alignment gate",
  ) as (opts: Record<string, unknown>) => unknown | Promise<unknown>;
}

export type MarketplaceFixtureOpts = {
  name?: string;
  projectVersion?: string;
  marketVersion?: string;
  strategy?: "lockstep" | "tag_pattern" | "per_package" | string;
  buildTagPattern?: string;
  packages?: Array<{ name: string; source: string; tag_pattern?: string }>;
  withOutputs?: boolean;
};

export function buildMarketplaceBapmYml(opts: MarketplaceFixtureOpts = {}): string {
  const name = opts.name ?? "monorepo";
  const projectVersion = opts.projectVersion ?? "1.0.0";
  const marketVersion = opts.marketVersion ?? projectVersion;
  const packages = opts.packages ?? [{ name: "demo", source: "./plugins/demo" }];
  const lines: string[] = [
    `name: ${name}`,
    `version: "${projectVersion}"`,
    `description: Acme marketplace`,
    `marketplace:`,
    `  name: acme-tools`,
    `  version: "${marketVersion}"`,
    `  owner: acme-org`,
  ];
  if (opts.strategy !== undefined) {
    lines.push(`  versioning:`, `    strategy: ${opts.strategy}`);
  }
  if (opts.buildTagPattern) {
    lines.push(`  build:`, `    tagPattern: "${opts.buildTagPattern}"`);
  }
  if (opts.withOutputs !== false) {
    lines.push(`  outputs:`, `    claude: true`);
  }
  lines.push(`  packages:`);
  for (const pkg of packages) {
    lines.push(`    - name: ${pkg.name}`, `      source: ${pkg.source}`);
    if (pkg.tag_pattern) {
      lines.push(`      tag_pattern: "${pkg.tag_pattern}"`);
    }
  }
  lines.push(``);
  return lines.join("\n");
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
  writeText(join(cwd, rel, "plugin.json"), `${JSON.stringify(manifest)}\n`);
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
  writeText(join(cwd, rel, filename), body);
}

/** Normalize authoring config.versioning.strategy (default lockstep when omitted). */
export function effectiveVersioningStrategy(config: unknown): string | undefined {
  const row = asRecord(config);
  const versioning = row.versioning;
  if (versioning === undefined || versioning === null) {
    // Typed authoring may also expose a flattened field; otherwise omitted until defaulted.
    if (typeof row.versioningStrategy === "string") return row.versioningStrategy;
    if (typeof row.strategy === "string" && row.packages) return undefined;
    return undefined;
  }
  if (typeof versioning === "string") return versioning;
  const v = asRecord(versioning);
  const strategy = v.strategy;
  if (typeof strategy !== "string" || !strategy) {
    throw new TypeError(`expected versioning.strategy string, got ${JSON.stringify(versioning)}`);
  }
  return strategy;
}

export function reportOk(report: unknown): boolean {
  const row = asRecord(report);
  if (typeof row.ok === "boolean") return row.ok;
  throw new TypeError(`expected VersionAlignmentReport.ok boolean, got ${JSON.stringify(report)}`);
}

export function reportStrategy(report: unknown): string {
  const row = asRecord(report);
  if (typeof row.strategy === "string") return row.strategy;
  throw new TypeError(`expected report.strategy string, got ${JSON.stringify(report)}`);
}

export function reportPackages(report: unknown): Array<Record<string, unknown>> {
  const row = asRecord(report);
  const packages = row.packages;
  if (!Array.isArray(packages)) {
    throw new TypeError(`expected report.packages array, got ${JSON.stringify(report)}`);
  }
  return packages.map((p) => asRecord(p));
}

export async function runAlignment(cwd: string, path?: string): Promise<unknown> {
  const load = getLoadMarketplaceFromBapmYml();
  const loaded = asRecord(load({ cwd, path }));
  const config = loaded.config ?? loaded;
  const check = getCheckVersionAlignment();
  return await check({
    config,
    cwd,
    projectRoot: cwd,
    root: cwd,
  });
}

export { core, join };
