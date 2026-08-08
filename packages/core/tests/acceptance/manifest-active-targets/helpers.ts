/**
 * Acceptance helpers for manifest-active-targets.
 * Behavioural contract only — no production source inspection.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as core from "@bapm/core";
import type { BapmManifest } from "@bapm/core";

type AnyFn = (...args: never[]) => unknown;

export type TempProject = {
  cwd: string;
  cleanup: () => void;
};

const suiteDir = dirname(fileURLToPath(import.meta.url));
export const coreRoot = resolve(suiteDir, "../../..");
export const repoRoot = resolve(coreRoot, "../..");
export const configManifestGuidePath = join(repoRoot, "apps/docs/guide/config-manifest.md");

export function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @bapm/core to export one of [${names.join(", ")}] (${label})`);
}

export function baseManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "acceptance-active",
    version: "0.0.1",
    ...overrides,
  };
}

export function parseManifestDocument(input: unknown): {
  document: BapmManifest;
  warnings?: unknown[];
} {
  return (
    pickExport(["parseManifestDocument", "parseManifest"], "Manifest parse") as (input: unknown) => {
      document: BapmManifest;
      warnings?: unknown[];
    }
  )(input);
}

export function parseOk(overrides: Record<string, unknown>): BapmManifest {
  const result = parseManifestDocument(baseManifest(overrides));
  if (result && typeof result === "object" && "document" in result) {
    return result.document;
  }
  return result as unknown as BapmManifest;
}

export function expectParseReject(overrides: Record<string, unknown>): {
  message: string;
  path?: string;
  details?: Record<string, unknown>;
} {
  try {
    parseOk(overrides);
  } catch (error) {
    const err = error as {
      message?: unknown;
      path?: unknown;
      details?: Record<string, unknown>;
    };
    return {
      message: error instanceof Error ? error.message : String(error),
      path: typeof err.path === "string" ? err.path : undefined,
      details: err.details,
    };
  }
  throw new Error(`expected parse to reject ${JSON.stringify(overrides)}`);
}

export function getLoadManifest(): (options: {
  cwd?: string;
  path?: string;
}) => { document: BapmManifest; sourcePath: string; sourceFilename: string } {
  return pickExport(["loadManifest"], "Manifest load") as (options: {
    cwd?: string;
    path?: string;
  }) => { document: BapmManifest; sourcePath: string; sourceFilename: string };
}

export function getDeclaredTargetIds(): (manifest: BapmManifest) => string[] {
  return pickExport(["declaredTargetIds"], "Install declaredTargetIds") as (
    manifest: BapmManifest,
  ) => string[];
}

export function getRunInstall(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["runInstall", "installProject"], "Install run") as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function getCompileAgentsMd(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["compileAgentsMd"], "Compile") as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function createTempProject(prefix = "bapm-acc-active-"): TempProject {
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

export async function importIntegrationApi(): Promise<Record<string, unknown>> {
  try {
    return (await import("@bapm/integration-api")) as Record<string, unknown>;
  } catch (e) {
    throw new TypeError(
      `expected package @bapm/integration-api to resolve: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
}

export function getCreateIntegrationRegistry(api: Record<string, unknown>): () => unknown {
  const fn = api.createIntegrationRegistry;
  if (typeof fn !== "function") {
    throw new TypeError("expected @bapm/integration-api to export createIntegrationRegistry");
  }
  return fn as () => unknown;
}

export function getRegisterIntegration(
  api: Record<string, unknown>,
  registry?: unknown,
): (target: unknown) => unknown {
  if (registry && typeof registry === "object") {
    const reg = registry as Record<string, unknown>;
    if (typeof reg.register === "function") {
      return (target: unknown) => (reg.register as (t: unknown) => unknown)(target);
    }
  }
  const fn = api.registerTarget ?? api.register;
  if (typeof fn !== "function") {
    throw new TypeError("expected registry.register or registerTarget export");
  }
  return fn as (target: unknown) => unknown;
}

export { core, join };
