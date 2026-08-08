import { createRequire } from "node:module";
import { join, relative, resolve, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import {
  declaredTargetIntegrationMap,
  loadManifest,
  ManifestError,
  type BapmManifest,
} from "@bapm/core";
import type { BapmIntegration, IntegrationRegistry } from "@bapm/integration-api";
import { isLocalPathSpecifier, resolveContainedLocalPath } from "./localPathSpecifier.ts";

export type ManifestIntegrationLoadCause =
  | "unresolvable"
  | "invalid_export"
  | "marketplace_only"
  | "id_mismatch";

/** Fail-closed diagnostic for object-map integration package load. */
export class ManifestIntegrationLoadError extends Error {
  readonly hostId: string;
  readonly specifier: string;
  readonly causeClass: ManifestIntegrationLoadCause;

  constructor(
    hostId: string,
    specifier: string,
    causeClass: ManifestIntegrationLoadCause,
    detail: string,
  ) {
    super(
      `Failed to load target integration "${hostId}" from "${specifier}": ${causeClass} — ${detail}`,
    );
    this.name = "ManifestIntegrationLoadError";
    this.hostId = hostId;
    this.specifier = specifier;
    this.causeClass = causeClass;
  }
}

function isContainedUnderRoot(absoluteTarget: string, projectRoot: string): boolean {
  const root = resolve(projectRoot);
  const targetRelativeToRoot = relative(root, resolve(absoluteTarget));
  if (targetRelativeToRoot === "") return true;
  return !(
    targetRelativeToRoot === ".." ||
    targetRelativeToRoot.startsWith("..\\") ||
    targetRelativeToRoot.startsWith("../") ||
    isAbsolute(targetRelativeToRoot)
  );
}

/** npm package: project cwd first, then CLI-shipped fallback. */
function resolveNpmPackageSpecifier(specifier: string, cwd: string): string {
  const requireFromCwd = createRequire(join(cwd, "package.json"));
  try {
    return requireFromCwd.resolve(specifier);
  } catch (cwdErr) {
    const requireFromCli = createRequire(import.meta.url);
    try {
      return requireFromCli.resolve(specifier);
    } catch {
      throw cwdErr;
    }
  }
}

/**
 * Local path: containment under project root, then createRequire from cwd only
 * (no CLI fallback — path miss fails closed).
 */
function resolveLocalIntegrationPath(specifier: string, hostId: string, cwd: string): string {
  const contained = resolveContainedLocalPath(specifier, cwd);
  if (contained === null) {
    throw new ManifestIntegrationLoadError(
      hostId,
      specifier,
      "unresolvable",
      `local path escapes project root (containment): ${specifier}`,
    );
  }

  const requireFromCwd = createRequire(join(cwd, "package.json"));
  let resolved: string;
  try {
    resolved = requireFromCwd.resolve(specifier);
  } catch (cause) {
    const detail =
      cause instanceof Error ? cause.message : "cannot find module / unresolvable path";
    throw new ManifestIntegrationLoadError(
      hostId,
      specifier,
      "unresolvable",
      `unresolvable local path / missing module: ${detail}`,
    );
  }

  if (!isContainedUnderRoot(resolved, cwd)) {
    throw new ManifestIntegrationLoadError(
      hostId,
      specifier,
      "unresolvable",
      `resolved local path escapes project root (containment): ${specifier}`,
    );
  }

  return resolved;
}

function isMarketplaceOnly(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  const mo = rec.marketplaceOutput;
  if (!mo || typeof mo !== "object") return false;
  const hasRuntime = typeof rec.detect === "function" && typeof rec.materialize === "function";
  return !hasRuntime;
}

function isRuntimeIntegration(value: unknown): value is BapmIntegration {
  if (!value || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  const id = typeof rec.id === "string" ? rec.id.trim() : "";
  return (
    id.length > 0 &&
    Array.isArray(rec.deployRoots) &&
    typeof rec.detect === "function" &&
    typeof rec.materialize === "function"
  );
}

function extractIntegrationCandidate(mod: Record<string, unknown>): unknown {
  if (typeof mod.createIntegration === "function") {
    return (mod.createIntegration as () => unknown)();
  }
  if (typeof mod.createCursorIntegration === "function") {
    return (mod.createCursorIntegration as () => unknown)();
  }
  if ("default" in mod) {
    const d = mod.default;
    return typeof d === "function" ? (d as () => unknown)() : d;
  }
  return undefined;
}

/**
 * Resolve a map value (npm package or local filesystem path) from project cwd,
 * import it, and extract a runtime `BapmIntegration`
 * (createIntegration → createCursorIntegration → default).
 */
export async function loadIntegrationFromPackage(
  specifier: string,
  expectedId: string,
  cwd: string,
): Promise<BapmIntegration> {
  let resolved: string;
  if (isLocalPathSpecifier(specifier)) {
    resolved = resolveLocalIntegrationPath(specifier, expectedId, cwd);
  } else {
    try {
      resolved = resolveNpmPackageSpecifier(specifier, cwd);
    } catch (cause) {
      const detail =
        cause instanceof Error ? cause.message : "cannot find module / unresolvable package";
      throw new ManifestIntegrationLoadError(
        expectedId,
        specifier,
        "unresolvable",
        `unresolvable module: ${detail}`,
      );
    }
  }

  let mod: Record<string, unknown>;
  try {
    const imported = await import(pathToFileURL(resolved).href);
    mod = (imported ?? {}) as Record<string, unknown>;
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new ManifestIntegrationLoadError(
      expectedId,
      specifier,
      "unresolvable",
      `failed to load module: ${detail}`,
    );
  }

  let candidate: unknown;
  try {
    candidate = extractIntegrationCandidate(mod);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new ManifestIntegrationLoadError(
      expectedId,
      specifier,
      "invalid_export",
      `invalid export / factory threw: ${detail}`,
    );
  }

  if (candidate === undefined) {
    throw new ManifestIntegrationLoadError(
      expectedId,
      specifier,
      "invalid_export",
      "package export is not a valid runtime integration (expected createIntegration, createCursorIntegration, or default export)",
    );
  }

  if (isMarketplaceOnly(candidate)) {
    throw new ManifestIntegrationLoadError(
      expectedId,
      specifier,
      "marketplace_only",
      "marketplace-only package is not a valid runtime integration (missing detect/materialize)",
    );
  }

  if (!isRuntimeIntegration(candidate)) {
    throw new ManifestIntegrationLoadError(
      expectedId,
      specifier,
      "invalid_export",
      "invalid export: not a valid runtime BapmIntegration (need id, deployRoots, detect, materialize)",
    );
  }

  if (candidate.id !== expectedId) {
    throw new ManifestIntegrationLoadError(
      expectedId,
      specifier,
      "id_mismatch",
      `integration id "${candidate.id}" does not match map key / expected "${expectedId}"`,
    );
  }

  return candidate;
}

/**
 * Eagerly load every `declaredTargetIntegrationMap` entry and register/replace by key.
 */
export async function registerManifestIntegrations(
  registry: IntegrationRegistry,
  manifest: BapmManifest,
  cwd: string,
): Promise<void> {
  const map = declaredTargetIntegrationMap(manifest);
  if (!map) return;

  for (const [hostId, specifier] of Object.entries(map)) {
    const integration = await loadIntegrationFromPackage(specifier, hostId, cwd);
    registry.register(integration);
  }
}

/**
 * Load project manifest (when present) and register object-map integrations onto `registry`.
 * Missing manifest is a no-op; other manifest errors and load failures propagate (fail-closed).
 */
export async function registerManifestIntegrationsFromCwd(
  registry: IntegrationRegistry,
  cwd: string,
): Promise<void> {
  let document: BapmManifest;
  try {
    ({ document } = loadManifest({ cwd }));
  } catch (error) {
    if (
      error instanceof ManifestError &&
      (error.code === "MANIFEST_NOT_FOUND" || error.code === "MANIFEST_MISSING_FILE")
    ) {
      return;
    }
    throw error;
  }
  await registerManifestIntegrations(registry, document, cwd);
}
