/**
 * Core helpers for marketplace pack-outputs suite.
 * Soft-resolve Marketplace builder / pack-outputs APIs from @b-apm/core.
 */
import * as core from "@b-apm/core";
import { createMarketplaceOutputRegistry } from "@b-apm/integration-api";
import { claudeMarketplaceIntegration } from "@b-apm/integration-claude";
import { codexMarketplaceIntegration } from "@b-apm/integration-codex";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const suiteDir = dirname(fileURLToPath(import.meta.url));
export const coreRoot = resolve(suiteDir, "../..");
export const srcRoot = join(coreRoot, "src");
export const marketplaceSrc = join(srcRoot, "modules", "Marketplace");

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

export function createTempProject(prefix = "bapm-mp-pack-outputs-core-"): TempProject {
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

export function readSrc(rel: string): string {
  return readFileSync(join(srcRoot, rel), "utf8");
}

/** Builder / pack-outputs entry (G1–G4). */
export function getBuildMarketplaceOutputs(): (opts: Record<string, unknown>) => unknown {
  const build = pickExport(
    [
      "buildMarketplaceOutputs",
      "emitMarketplacePackOutputs",
      "runMarketplaceBuilder",
      "writeMarketplacePackOutputs",
    ],
    "marketplace pack outputs builder",
  ) as (opts: Record<string, unknown>) => unknown;
  return (opts) => build({ ...opts, marketplaceOutputs: createMarketplaceOutputsRegistry() });
}

export function createMarketplaceOutputsRegistry() {
  const registry = createMarketplaceOutputRegistry();
  registry.register(claudeMarketplaceIntegration);
  registry.register(codexMarketplaceIntegration);
  return registry;
}

export function getResolveMarketplacePackages(): (opts: Record<string, unknown>) => unknown {
  return pickExport(
    ["resolveMarketplacePackages", "resolveAuthoringPackages", "resolveMarketplacePackPackages"],
    "resolve authoring packages to ResolvedPackage[]",
  ) as (opts: Record<string, unknown>) => unknown;
}

export function validLocalAuthoringYml(): string {
  return [
    `name: acme`,
    `version: "0.1.0"`,
    `marketplace:`,
    `  owner: acme-org`,
    `  outputs:`,
    `    claude: true`,
    `  packages:`,
    `    - name: demo`,
    `      source: ./plugins/demo`,
    ``,
  ].join("\n");
}

export { core, existsSync, join };
