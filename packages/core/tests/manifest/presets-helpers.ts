/**
 * Helpers for manifest presets / structured active suites
 * (promoted from manifest-presets acceptance).
 */
import { asText } from "../asText.ts";
import * as core from "@b-apm/core";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export type TempProject = { cwd: string; cleanup: () => void };

type AnyFn = (...args: never[]) => unknown;

export function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @b-apm/core to export one of [${names.join(", ")}] (${label})`);
}

export function createTempProject(prefix = "bapm-presets-"): TempProject {
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

export function writeBaseManifest(
  cwd: string,
  body: string,
  filename: "bapm.yml" | "apm.yml" = "bapm.yml",
): void {
  writeText(join(cwd, filename), body);
}

export function writeLocalOverlay(cwd: string, body: string): void {
  writeText(join(cwd, "bapm.local.yml"), body);
}

export function writePackageAt(cwd: string, relDir: string, name: string): void {
  writeText(
    join(cwd, relDir, "apm.yml"),
    `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
  );
}

export function baseManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "presets-suite",
    version: "0.0.1",
    ...overrides,
  };
}

export function parseManifestDocument(input: unknown): {
  document: Record<string, unknown>;
  warnings?: unknown[];
} {
  const result = (
    pickExport(["parseManifestDocument", "parseManifest"], "Manifest parse") as (
      input: unknown,
    ) => unknown
  )(input);
  if (result && typeof result === "object" && "document" in result) {
    return result as { document: Record<string, unknown>; warnings?: unknown[] };
  }
  return { document: result as Record<string, unknown> };
}

export function parseOk(overrides: Record<string, unknown>): Record<string, unknown> {
  return parseManifestDocument(baseManifest(overrides)).document;
}

export function expectParseReject(overrides: Record<string, unknown>): {
  message: string;
  path?: string;
  details?: Record<string, unknown>;
} {
  try {
    parseOk(overrides);
  } catch (error) {
    if (error instanceof TypeError && /is not a function/i.test(error.message)) {
      throw error;
    }
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

export function getLoadManifest(): (options: Record<string, unknown>) => {
  document: Record<string, unknown>;
  sourcePath?: string;
  sourceFilename?: string;
} {
  return pickExport(["loadManifest"], "Manifest load") as (options: Record<string, unknown>) => {
    document: Record<string, unknown>;
    sourcePath?: string;
    sourceFilename?: string;
  };
}

export function getLoadEffectiveManifest(): (options: Record<string, unknown>) => unknown {
  return pickExport(["loadEffectiveManifest", "loadManifest"], "effective manifest load") as (
    options: Record<string, unknown>,
  ) => unknown;
}

export function getWriteProducerManifest(): (
  document: Record<string, unknown>,
  options?: Record<string, unknown>,
) => unknown {
  return pickExport(
    ["writeProducerManifest", "emitManifest", "writeManifestValidated"],
    "producer emit",
  ) as (document: Record<string, unknown>, options?: Record<string, unknown>) => unknown;
}

/** Pure expansion: resolveActive(doc) → { presetIds, targetIds }. */
export function getResolveActive(): (doc: unknown, ...rest: unknown[]) => unknown {
  return pickExport(
    ["resolveActive", "expandActive", "resolveManifestActive", "resolveActiveSelection"],
    "resolveActive",
  ) as (doc: unknown, ...rest: unknown[]) => unknown;
}

export function getEffectiveDirectDeps(): (
  doc: unknown,
  presetIds?: unknown,
  ...rest: unknown[]
) => unknown {
  return pickExport(
    ["effectiveDirectDeps", "effectiveManifestDeps", "unionPresetDependencies"],
    "effectiveDirectDeps",
  ) as (doc: unknown, presetIds?: unknown, ...rest: unknown[]) => unknown;
}

export function getResolveDependencyGraph(): (
  options: Record<string, unknown>,
) => Promise<{ nodes: Array<Record<string, unknown>> }> {
  return pickExport(["resolveDependencyGraph", "resolveGraph"], "resolveDependencyGraph") as (
    options: Record<string, unknown>,
  ) => Promise<{ nodes: Array<Record<string, unknown>> }>;
}

export function getResolveAndLock(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["resolveAndLock"], "resolveAndLock") as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function getRunInstall(): (options: Record<string, unknown>) => Promise<unknown> {
  return pickExport(["runInstall", "installProject"], "Install run") as (
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

export function documentOf(result: unknown): Record<string, unknown> {
  if (result === null || typeof result !== "object") {
    throw new TypeError("expected load result object");
  }
  const r = result as Record<string, unknown>;
  const doc = (r.document ?? r.manifest ?? r) as Record<string, unknown>;
  if (doc === null || typeof doc !== "object") {
    throw new TypeError("expected document/manifest object on load result");
  }
  return doc;
}

export function expectThrowsMatching(fn: () => unknown, pattern: RegExp): unknown {
  let thrown: unknown;
  try {
    fn();
  } catch (e) {
    thrown = e;
  }
  if (thrown === undefined) {
    throw new Error(`expected throw matching ${pattern}`);
  }
  if (thrown instanceof TypeError && /is not a function/i.test(thrown.message)) {
    throw thrown;
  }
  const message =
    thrown instanceof Error
      ? thrown.message
      : typeof thrown === "object" && thrown !== null && "message" in thrown
        ? asText((thrown as { message: unknown }).message)
        : asText(thrown);
  const code =
    typeof thrown === "object" && thrown !== null && "code" in thrown
      ? asText((thrown as { code: unknown }).code)
      : "";
  const haystack = `${message}\n${code}`;
  if (!pattern.test(haystack)) {
    throw new Error(`expected error matching ${pattern}, got: ${haystack}`);
  }
  return thrown;
}

export async function expectAsyncThrowsMatching(
  fn: () => Promise<unknown>,
  pattern: RegExp,
): Promise<unknown> {
  let thrown: unknown;
  try {
    await fn();
  } catch (e) {
    thrown = e;
  }
  if (thrown === undefined) {
    throw new Error(`expected async throw matching ${pattern}`);
  }
  if (thrown instanceof TypeError && /is not a function/i.test(thrown.message)) {
    throw thrown;
  }
  const message =
    thrown instanceof Error
      ? thrown.message
      : typeof thrown === "object" && thrown !== null && "message" in thrown
        ? asText((thrown as { message: unknown }).message)
        : asText(thrown);
  const code =
    typeof thrown === "object" && thrown !== null && "code" in thrown
      ? asText((thrown as { code: unknown }).code)
      : "";
  const haystack = `${message}\n${code}`;
  if (!pattern.test(haystack)) {
    throw new Error(`expected error matching ${pattern}, got: ${haystack}`);
  }
  return thrown;
}

export type ActiveEntryLike = { kind: string; id: string; negate: boolean };

/** Normalize retained `active` into ActiveEntry-like records. */
export function activeEntriesOf(doc: Record<string, unknown>): ActiveEntryLike[] {
  const active = doc.active;
  if (!Array.isArray(active)) {
    throw new TypeError(`expected document.active array, got ${asText(active)}`);
  }
  return active.map((entry, i) => {
    if (entry === null || typeof entry !== "object") {
      throw new TypeError(`expected ActiveEntry at active[${i}], got ${asText(entry)}`);
    }
    const e = entry as Record<string, unknown>;
    const kind = asText(e.kind ?? e.type);
    const id = asText(e.id ?? e.name ?? e.value);
    const negate = Boolean(e.negate ?? e.negated ?? e.exclude);
    if (!kind || !id) {
      throw new TypeError(`expected kind+id ActiveEntry at active[${i}], got ${asText(entry)}`);
    }
    return { kind, id, negate };
  });
}

export function presetNamesOf(doc: Record<string, unknown>): string[] {
  const presets = doc.presets;
  if (!Array.isArray(presets)) {
    throw new TypeError(`expected document.presets array, got ${asText(presets)}`);
  }
  return presets.map((p, i) => {
    if (p === null || typeof p !== "object") {
      throw new TypeError(`expected preset object at presets[${i}]`);
    }
    const name = asText((p as Record<string, unknown>).name);
    if (!name) throw new TypeError(`expected preset name at presets[${i}]`);
    return name;
  });
}

export function resolvedIdsOf(result: unknown): { presetIds: string[]; targetIds: string[] } {
  if (result === null || typeof result !== "object") {
    throw new TypeError("expected resolveActive result object");
  }
  const r = result as Record<string, unknown>;
  const presets = r.presetIds ?? r.presets ?? r.includedPresets;
  const targets = r.targetIds ?? r.targets ?? r.includedTargets;
  if (!Array.isArray(presets) || !Array.isArray(targets)) {
    throw new TypeError(
      `expected { presetIds, targetIds } arrays, got ${asText({ presetIds: presets, targetIds: targets })}`,
    );
  }
  return {
    presetIds: presets.map((x) => asText(x)).filter(Boolean),
    targetIds: targets.map((x) => asText(x)).filter(Boolean),
  };
}

export function nodeNames(result: { nodes: Array<Record<string, unknown>> }): string[] {
  return result.nodes.map((n) => asText(n.name)).filter(Boolean);
}

export function developerAnalystPresetsYaml(): string {
  return [
    "presets:",
    "  - name: analyst",
    "    dependencies:",
    "      apm:",
    "        - local: ./pkgs/analyst-skill",
    "  - name: developer",
    "    dependencies:",
    "      apm:",
    "        - local: ./pkgs/dev-skill",
    "",
  ].join("\n");
}

export { core, join };
