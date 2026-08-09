/**
 * Acceptance helpers for manifest-env-bake (RED suite).
 * Behavioural contract only — no production source inspection.
 */
import * as core from "@bapm/core";
import type { BapmManifest } from "@bapm/core";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

type AnyFn = (...args: never[]) => unknown;

export type BakeOptions = {
  overrides?: Record<string, string>;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  /** Project manifest top-level `env` defaults (overrides → process.env → this). */
  manifestEnv?: Record<string, string>;
  mode?: "bake" | "translate";
};

export type TempProject = { cwd: string; cleanup: () => void };

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
    name: "manifest-env-bake-root",
    version: "0.0.1",
    ...overrides,
  };
}

export function parseManifestDocument(input: unknown): {
  document: BapmManifest;
  warnings?: unknown[];
} {
  return (
    pickExport(["parseManifestDocument", "parseManifest"], "Manifest parse") as (
      input: unknown,
    ) => { document: BapmManifest; warnings?: unknown[] }
  )(input);
}

/** Parse and return the validated document (unwrap Result-style if needed). */
export function parseOk(overrides: Record<string, unknown> = {}): BapmManifest {
  const result = parseManifestDocument(baseManifest(overrides));
  if (result && typeof result === "object" && "document" in result) {
    return result.document;
  }
  return result as unknown as BapmManifest;
}

export function expectParseReject(overrides: Record<string, unknown>): string {
  try {
    parseOk(overrides);
    throw new Error(`expected parse to reject, got document for ${JSON.stringify(overrides)}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("expected parse to reject")) {
      throw error;
    }
    return error instanceof Error ? error.message : String(error);
  }
}

export function getBakeMcpStringMap(): (
  map: Record<string, string>,
  options?: BakeOptions,
) => unknown {
  return pickExport(
    [
      "bakeMcpStringMap",
      "bakeMcpEnvMap",
      "resolveMcpEnvPlaceholders",
      "bakeMcpPlaceholders",
      "bakeMcpEnv",
    ],
    "MCP env/headers bake",
  ) as (map: Record<string, string>, options?: BakeOptions) => unknown;
}

function asBakeSuccess(result: unknown): Record<string, string> {
  if (result && typeof result === "object" && "ok" in result) {
    const r = result as { ok: unknown; value?: unknown; env?: unknown; map?: unknown };
    if (!r.ok) {
      const message = String(
        (r as { message?: unknown; error?: unknown }).message ??
          (r as { error?: unknown }).error ??
          "bake failed",
      );
      throw Object.assign(new Error(message), { bakeResult: result });
    }
    const value = r.value ?? r.env ?? r.map;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, string>;
    }
    throw new TypeError("bake succeeded without a string map value");
  }
  if (result && typeof result === "object" && !Array.isArray(result)) {
    return result as Record<string, string>;
  }
  throw new TypeError(`bake returned unexpected value: ${String(result)}`);
}

/** Invoke bake; unwrap Result-style returns; rethrow failures. */
export function bakeMap(
  map: Record<string, string>,
  options?: BakeOptions,
): Record<string, string> {
  return asBakeSuccess(getBakeMcpStringMap()(map, options));
}

/** Expect bake to fail; return the diagnostic message text. */
export function expectBakeFailure(map: Record<string, string>, options?: BakeOptions): string {
  getBakeMcpStringMap();
  try {
    const value = bakeMap(map, options);
    throw new Error(`expected bake to fail, got ${JSON.stringify(value)}`);
  } catch (error) {
    if (error instanceof TypeError && /expected @bapm\/core to export/i.test(error.message)) {
      throw error;
    }
    if (error instanceof Error && error.message.startsWith("expected bake to fail")) {
      throw error;
    }
    if (error && typeof error === "object" && "bakeResult" in error) {
      const r = (error as { bakeResult: unknown }).bakeResult;
      return JSON.stringify(r);
    }
    return error instanceof Error ? error.message : String(error);
  }
}

export function createTempProject(prefix = "bapm-manifest-env-bake-"): TempProject {
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

export function writeBaseManifest(cwd: string, body: string): void {
  writeText(join(cwd, "bapm.yml"), body);
}

export function writeLocalOverlay(cwd: string, body: string): void {
  writeText(join(cwd, "bapm.local.yml"), body);
}

export function conformingBase(overrides?: {
  name?: string;
  version?: string;
  extraYaml?: string;
}): string {
  const name = overrides?.name ?? "manifest-env-bake";
  const version = overrides?.version ?? "0.1.0";
  const extra = overrides?.extraYaml ? `${overrides.extraYaml.trimEnd()}\n` : "";
  return `name: ${name}\nversion: "${version}"\ndependencies:\n  apm: []\n  mcp: []\n${extra}`;
}

/**
 * Effective load: prefer loadEffectiveManifest; fall back to loadManifest.
 */
export function getLoadEffectiveManifest(): (options: Record<string, unknown>) => unknown {
  const c = core as Record<string, unknown>;
  if (typeof c.loadEffectiveManifest === "function") {
    return c.loadEffectiveManifest as (options: Record<string, unknown>) => unknown;
  }
  return pickExport(["loadManifest"], "effective manifest load") as (
    options: Record<string, unknown>,
  ) => unknown;
}

export function documentOf(result: unknown): BapmManifest {
  if (result && typeof result === "object" && "document" in result) {
    return (result as { document: BapmManifest }).document;
  }
  return result as BapmManifest;
}

export function expectLoadReject(cwd: string): string {
  try {
    const doc = documentOf(getLoadEffectiveManifest()({ cwd }));
    throw new Error(`expected effective load to reject, got ${JSON.stringify(doc.env)}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("expected effective load to reject")) {
      throw error;
    }
    return error instanceof Error ? error.message : String(error);
  }
}
