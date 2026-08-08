/**
 * Personal overlay `bapm.local.yml`: allowlist validate + merge into base manifest.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ManifestError } from "./errors.ts";
import { parseManifestDocument } from "./parse.ts";
import type { BapmManifest, RegistryEntry, TargetIntegrationMap } from "./types.ts";
import { loadYamlDocument } from "./yaml-load.ts";

export const BAPM_LOCAL_MANIFEST_FILE = "bapm.local.yml";
/** Unsupported dual-brand local overlay filename (v1 refuse). */
export const APM_LOCAL_MANIFEST_FILE = "apm.local.yml";

const OVERLAY_ALLOWLIST = new Set(["active", "target", "targets", "env", "registries"]);

export type LocalOverlayFields = {
  active?: string[];
  target?: string | TargetIntegrationMap;
  targets?: string[] | TargetIntegrationMap;
  env?: Record<string, string>;
  registries?: Record<string, RegistryEntry | string>;
};

/**
 * Resolve project root that hosts the optional local overlay (same dir as base file).
 * No parent walk-up.
 */
export function overlayRootForBase(sourcePath: string): string {
  return dirname(sourcePath);
}

/**
 * Fail closed when `apm.local.yml` is present beside the base manifest.
 */
export function assertNoApmLocalOverlay(projectRoot: string): void {
  const apmLocal = join(projectRoot, APM_LOCAL_MANIFEST_FILE);
  if (!existsSync(apmLocal)) return;
  throw new ManifestError(
    "MANIFEST_VALIDATION",
    `Unsupported local overlay file ${APM_LOCAL_MANIFEST_FILE} (v1 supports only ${BAPM_LOCAL_MANIFEST_FILE}). ` +
      `Remove ${APM_LOCAL_MANIFEST_FILE} or rename to ${BAPM_LOCAL_MANIFEST_FILE}.`,
    { path: apmLocal, details: { unsupported: APM_LOCAL_MANIFEST_FILE } },
  );
}

/**
 * Load + validate optional `bapm.local.yml` at project root.
 * Returns `undefined` when the file is absent.
 */
export function loadLocalOverlayIfPresent(
  projectRoot: string,
): { fields: LocalOverlayFields; localPath: string } | undefined {
  const localPath = join(projectRoot, BAPM_LOCAL_MANIFEST_FILE);
  if (!existsSync(localPath)) return undefined;

  let text: string;
  try {
    text = readFileSync(localPath, "utf8");
  } catch (cause) {
    throw new ManifestError(
      "MANIFEST_MISSING_FILE",
      `Local overlay file not readable: ${localPath}`,
      { path: localPath, cause },
    );
  }

  const raw = loadYamlDocument(text, localPath);
  const fields = parseLocalOverlayDocument(raw, localPath);
  return { fields, localPath };
}

/**
 * Validate overlay YAML: mapping + allowlist + field shapes (via stub parse).
 */
export function parseLocalOverlayDocument(input: unknown, sourcePath?: string): LocalOverlayFields {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      `${BAPM_LOCAL_MANIFEST_FILE} must contain a YAML object/mapping at the document root`,
      { path: sourcePath },
    );
  }

  const raw = input as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!OVERLAY_ALLOWLIST.has(key)) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Local overlay key "${key}" is not allowed (allowlist: active, target, targets, env, registries)`,
        { path: sourcePath ? `${sourcePath}:${key}` : key, details: { key, forbidden: true } },
      );
    }
  }

  let env: Record<string, string> | undefined;
  if ("env" in raw && raw.env !== undefined) {
    env = validateOverlayEnv(raw.env, sourcePath);
  }

  // Shape-check allowlisted fields via stub document (name/version required by base parse).
  const stub: Record<string, unknown> = {
    name: "__bapm_local_overlay__",
    version: "0.0.0",
  };
  for (const key of ["active", "target", "targets"] as const) {
    if (key in raw && raw[key] !== undefined) {
      stub[key] = raw[key];
    }
  }

  // Registries: validate entry shapes without requiring `default` to resolve against
  // base-only names — full validate runs after merge on the effective document.
  if ("registries" in raw && raw.registries !== undefined) {
    stub.registries = stripRegistriesDefaultForStub(raw.registries);
  }

  const { document } = parseManifestDocument(stub);

  const fields: LocalOverlayFields = {};
  if (document.active !== undefined) fields.active = document.active;
  if (document.target !== undefined) fields.target = document.target;
  if (document.targets !== undefined) fields.targets = document.targets;
  if (env !== undefined) fields.env = env;
  if ("registries" in raw && raw.registries !== undefined) {
    // Keep local registries (including default pointer) for merge; shapes checked above.
    fields.registries = raw.registries as Record<string, RegistryEntry | string>;
  }
  return fields;
}

function stripRegistriesDefaultForStub(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  const copy = { ...(value as Record<string, unknown>) };
  delete copy.default;
  return copy;
}

function validateOverlayEnv(value: unknown, sourcePath?: string): Record<string, string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ManifestError(
      "MANIFEST_VALIDATION",
      'Local overlay "env" must be a mapping of string keys to string values',
      { path: sourcePath ? `${sourcePath}:env` : "env" },
    );
  }
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "string") {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Local overlay "env.${key}" must be a string`,
        { path: sourcePath ? `${sourcePath}:env.${key}` : `env.${key}` },
      );
    }
    out[key] = entry;
  }
  return out;
}

/**
 * Merge allowlisted local fields over a validated base document, then re-validate.
 */
export function mergeLocalOverlay(base: BapmManifest, overlay: LocalOverlayFields): BapmManifest {
  const merged: Record<string, unknown> = { ...base };

  if (overlay.active !== undefined) {
    merged.active = overlay.active;
  }

  if (overlay.env !== undefined) {
    const baseEnv =
      base.env !== null && typeof base.env === "object" && !Array.isArray(base.env)
        ? (base.env as Record<string, unknown>)
        : {};
    const nextEnv: Record<string, string> = {};
    for (const [k, v] of Object.entries(baseEnv)) {
      if (typeof v === "string") nextEnv[k] = v;
    }
    Object.assign(nextEnv, overlay.env);
    merged.env = nextEnv;
  }

  if (overlay.registries !== undefined) {
    merged.registries = mergeRegistriesMaps(base.registries, overlay.registries);
  }

  if (overlay.target !== undefined || overlay.targets !== undefined) {
    if (overlay.target !== undefined && overlay.targets !== undefined) {
      throw new ManifestError(
        "MANIFEST_VALIDATION",
        `Local overlay must not declare both "target" and "targets"`,
        { path: "target" },
      );
    }

    if (overlay.target !== undefined) {
      merged.target = mergeTargetOrTargetsField(base.target, overlay.target);
      delete merged.targets;
    } else if (overlay.targets !== undefined) {
      merged.targets = mergeTargetOrTargetsField(base.targets, overlay.targets);
      delete merged.target;
    }
  }

  return parseManifestDocument(merged).document;
}

function mergeRegistriesMaps(
  base: Record<string, RegistryEntry | string> | undefined,
  local: Record<string, RegistryEntry | string>,
): Record<string, RegistryEntry | string> {
  const out: Record<string, RegistryEntry | string> = { ...base };

  for (const [name, localEntry] of Object.entries(local)) {
    if (name === "default") {
      out.default = localEntry as string;
      continue;
    }

    const baseEntry = out[name];
    if (typeof localEntry === "string") {
      out[name] = localEntry;
      continue;
    }

    if (
      baseEntry !== undefined &&
      typeof baseEntry !== "string" &&
      localEntry !== null &&
      typeof localEntry === "object" &&
      !Array.isArray(localEntry)
    ) {
      out[name] = { ...baseEntry, ...localEntry } as RegistryEntry;
      continue;
    }

    out[name] = localEntry;
  }

  return out;
}

function isPlainObjectMap(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStringValuedMap(value: unknown): value is TargetIntegrationMap {
  if (!isPlainObjectMap(value)) return false;
  return Object.values(value).every((v) => typeof v === "string");
}

function mergeTargetOrTargetsField(
  base: string | string[] | TargetIntegrationMap | undefined,
  local: string | string[] | TargetIntegrationMap,
): string | string[] | TargetIntegrationMap {
  if (isStringValuedMap(base) && isStringValuedMap(local)) {
    return { ...base, ...local };
  }
  return local;
}
