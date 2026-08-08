/**
 * Acceptance helpers for integration-claude-runtime (RED until runtime lands).
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { BapmIntegration, ConfigureMcpFn } from "@bapm/integration-api";
import { getConfigureMcp } from "@bapm/integration-api";

const HERE = dirname(fileURLToPath(import.meta.url));
export const PKG_ROOT = resolve(HERE, "../../..");
export const REPO_ROOT = resolve(PKG_ROOT, "../..");
export const CORE_ROOT = join(REPO_ROOT, "packages/core");

export type TempDir = { cwd: string; cleanup: () => void };

export function createTempDir(prefix = "bapm-acc-claude-"): TempDir {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

export function writeText(cwd: string, relative: string, contents: string): void {
  const path = join(cwd, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

export type ClaudeModule = {
  createClaudeIntegration?: (options?: { id?: string; deployRoots?: string[] }) => BapmIntegration;
  createIntegration?: (options?: { id?: string; deployRoots?: string[] }) => BapmIntegration;
  mapClaudeMarketplace?: (config: unknown, resolved: unknown[]) => Record<string, unknown>;
  claudeMarketplaceIntegration?: {
    id: string;
    marketplaceOutput: { format: string; defaultOutput: string };
  };
  default?: unknown;
};

/** Load `@bapm/integration-claude` (marketplace + eventual runtime factory). */
export async function loadClaudeModule(): Promise<ClaudeModule> {
  const pkgJson = join(PKG_ROOT, "package.json");
  if (!existsSync(pkgJson)) {
    throw new Error(`expected package at packages/integration-claude (missing ${pkgJson})`);
  }

  try {
    return (await import("@bapm/integration-claude")) as ClaudeModule;
  } catch {
    const srcEntry = join(PKG_ROOT, "src/index.ts");
    if (!existsSync(srcEntry)) {
      throw new Error(`@bapm/integration-claude not resolvable and missing ${srcEntry}`);
    }
    return (await import(pathToFileURL(srcEntry).href)) as ClaudeModule;
  }
}

export async function createClaudeTarget(): Promise<BapmIntegration> {
  const mod = await loadClaudeModule();
  const factory = mod.createClaudeIntegration ?? mod.createIntegration;
  if (typeof factory !== "function") {
    throw new TypeError(
      "expected createClaudeIntegration or createIntegration export from @bapm/integration-claude",
    );
  }
  return factory();
}

export function requireConfigureMcp(target: BapmIntegration): ConfigureMcpFn {
  const fn = getConfigureMcp(target);
  if (!fn) {
    throw new TypeError(
      "expected createClaudeIntegration() to expose configureMcp (or writeMcpConfig/deployMcp)",
    );
  }
  return fn;
}

export function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

export { existsSync, join, mkdirSync, readFileSync, writeFileSync };
