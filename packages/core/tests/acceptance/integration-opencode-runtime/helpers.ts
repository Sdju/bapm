/**
 * Acceptance helpers for integration-opencode-runtime (RED until package exists).
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { BapmIntegration, ConfigureMcpFn } from "@bapm/integration-api";
import { getConfigureMcp } from "@bapm/integration-api";

const HERE = dirname(fileURLToPath(import.meta.url));
export const CORE_ROOT = resolve(HERE, "../../..");
export const REPO_ROOT = resolve(CORE_ROOT, "../..");
export const OPENCODE_PKG_ROOT = join(REPO_ROOT, "packages/integration-opencode");

export type TempDir = { cwd: string; cleanup: () => void };

export function createTempDir(prefix = "bapm-acc-opencode-"): TempDir {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

export function writeText(cwd: string, relative: string, contents: string): void {
  const path = join(cwd, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

export type OpencodeModule = {
  createOpencodeIntegration: (options?: {
    id?: string;
    deployRoots?: string[];
  }) => BapmIntegration;
  createIntegration?: (options?: { id?: string; deployRoots?: string[] }) => BapmIntegration;
  default?: unknown;
};

/** Load `@bapm/integration-opencode` once apply scaffolds the package. */
export async function loadOpencodeModule(): Promise<OpencodeModule> {
  const pkgJson = join(OPENCODE_PKG_ROOT, "package.json");
  if (!existsSync(pkgJson)) {
    throw new Error(
      `expected package at packages/integration-opencode (missing ${pkgJson})`,
    );
  }

  try {
    return (await import("@bapm/integration-opencode")) as OpencodeModule;
  } catch {
    const srcEntry = join(OPENCODE_PKG_ROOT, "src/index.ts");
    if (!existsSync(srcEntry)) {
      throw new Error(`@bapm/integration-opencode not resolvable and missing ${srcEntry}`);
    }
    return (await import(pathToFileURL(srcEntry).href)) as OpencodeModule;
  }
}

export async function createOpencodeTarget(): Promise<BapmIntegration> {
  const mod = await loadOpencodeModule();
  const factory = mod.createOpencodeIntegration ?? mod.createIntegration;
  if (typeof factory !== "function") {
    throw new TypeError(
      "expected createOpencodeIntegration or createIntegration export from @bapm/integration-opencode",
    );
  }
  return factory();
}

export function requireConfigureMcp(target: BapmIntegration): ConfigureMcpFn {
  const fn = getConfigureMcp(target);
  if (!fn) {
    throw new TypeError(
      "expected createOpencodeIntegration() to expose configureMcp (or writeMcpConfig/deployMcp)",
    );
  }
  return fn;
}

export function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

export { existsSync, join, readFileSync, writeFileSync, mkdirSync };
