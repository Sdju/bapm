/**
 * Core M9 acceptance helpers — package graph + pickExport for TDD RED APIs.
 */
import * as core from "@bapm/core";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const suiteDir = dirname(fileURLToPath(import.meta.url));
export const coreRoot = resolve(suiteDir, "../..");
export const repoRoot = resolve(coreRoot, "../..");

type AnyFn = (...args: never[]) => unknown;

export function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @bapm/core to export one of [${names.join(", ")}] (${label})`);
}

export function listBapmIntegrationPackageNames(): string[] {
  const packagesDir = join(repoRoot, "packages");
  if (!existsSync(packagesDir)) return [];
  const names: string[] = [];
  for (const entry of readdirSync(packagesDir)) {
    const dir = join(packagesDir, entry);
    if (!statSync(dir).isDirectory()) continue;
    const pkgPath = join(dir, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string };
    if (typeof pkg.name === "string" && pkg.name.startsWith("@bapm/integration-")) {
      names.push(pkg.name);
    }
  }
  return names.sort();
}

export function getEvaluateExecutableTrust(): (options: Record<string, unknown>) => unknown {
  return pickExport(
    [
      "evaluateExecutableTrust",
      "evaluateMcpExecutableTrust",
      "gateExecutableMcp",
      "checkExecutableTrust",
    ],
    "M9 sc-009 executable trust",
  ) as (options: Record<string, unknown>) => unknown;
}

export function getCompileAgentsMd(): (options: Record<string, unknown>) => unknown {
  return pickExport(
    ["compileAgentsMd", "compileProject", "runCompile", "emitAgentsMd"],
    "M9 compile → AGENTS.md",
  ) as (options: Record<string, unknown>) => unknown;
}

export function getCacheInfo(): (options: Record<string, unknown>) => unknown {
  return pickExport(["cacheInfo", "getCacheInfo", "modulesCacheInfo"], "M9 cache info") as (
    options: Record<string, unknown>,
  ) => unknown;
}
