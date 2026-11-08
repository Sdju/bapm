import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { AGENT_PLUGIN_MANIFEST_SCHEMA_V1 } from "@/modules/AgentPlugins";
import { isValidPluginName, loadManifest, ManifestError } from "@/modules/Manifest";
import type { MarketplaceAuthoringConfig, PackageEntry } from "@/modules/Marketplace";
import { PackError } from "./errors.ts";

/** Semver 2.0.0 (no leading `v`) — the version shape strict metadata accepts. */
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
/** Version ranges are not fixed display versions and cannot certify metadata. */
const VERSION_RANGE_RE = /[\^~><=* ]/;

/** Standard Plugin root locations validated by strict pack metadata. */
const PLUGIN_JSON_LOCATIONS = [
  "plugin.json",
  ".claude-plugin/plugin.json",
  ".github/plugin/plugin.json",
  ".cursor-plugin/plugin.json",
] as const;

const MAX_PLUGIN_JSON_BYTES = 1024 * 1024;

export type StrictMetadataIssue = {
  /** User-facing field path, e.g. `bapm.yml#/version` or `plugin.json#/author/name`. */
  path: string;
  message: string;
};

export type ValidatePackStrictMetadataOptions = {
  cwd?: string;
  /** Agent Plugins v1 portable root: validate only root `plugin.json`. */
  agentPlugins?: boolean;
};

/**
 * Conservative producer metadata schema for `pack --strict-metadata`.
 *
 * Enforced (documented in apps/docs/reference/pack.md):
 * - manifest `name` and semver `version`; optional metadata fields must have the
 *   OpenAPM shape when present;
 * - root / standard-location `plugin.json` metadata shape (Agent Plugins v1
 *   additionally requires `$schema` and a valid portable plugin name);
 * - marketplace package entries: remote packages need an explicit non-empty
 *   `description` and fixed display `version` because bapm does not fetch remote
 *   metadata. Local packages pass through for free.
 */
export function validatePackStrictMetadata(options: ValidatePackStrictMetadataOptions = {}): void {
  const cwd = resolve(options.cwd ?? process.cwd());
  const issues: StrictMetadataIssue[] = [];

  if (options.agentPlugins === true) {
    const pluginJsonPath = join(cwd, "plugin.json");
    if (!isRegularFile(pluginJsonPath)) {
      issues.push({ path: "plugin.json", message: "is required for Agent Plugins pack" });
    } else {
      inspectPluginJson(pluginJsonPath, "plugin.json", { agentPlugins: true }, issues);
    }
  } else {
    inspectManifest(cwd, issues);
    for (const relativePath of PLUGIN_JSON_LOCATIONS) {
      const pluginJsonPath = join(cwd, relativePath);
      if (existsSync(pluginJsonPath)) {
        inspectPluginJson(pluginJsonPath, relativePath, { agentPlugins: false }, issues);
      }
    }
  }

  throwIfIssues(issues);
}

/** Validate marketplace authoring metadata selected for host output emission. */
export function validateMarketplaceStrictMetadata(config: MarketplaceAuthoringConfig): void {
  const issues: StrictMetadataIssue[] = [];

  if (config.name !== undefined && !isNonEmptyString(config.name)) {
    issues.push({ path: "marketplace.name", message: "must be a non-empty string" });
  }
  if (config.description !== undefined && !isNonEmptyString(config.description)) {
    issues.push({ path: "marketplace.description", message: "must be a non-empty string" });
  }
  if (config.version !== undefined && !isSemver(config.version)) {
    issues.push({
      path: "marketplace.version",
      message: `must be semver 2.0.0 (got ${JSON.stringify(config.version)})`,
    });
  }

  config.packages.forEach((pkg, index) => {
    inspectMarketplacePackage(pkg, `marketplace.packages[${index}]`, issues);
  });

  throwIfIssues(issues);
}

export function formatStrictMetadataIssues(issues: readonly StrictMetadataIssue[]): string {
  const noun = issues.length === 1 ? "issue" : "issues";
  const lines = issues.map((issue) => `  ${issue.path}: ${issue.message}`);
  return `Strict metadata validation failed (${issues.length} ${noun}):\n${lines.join("\n")}`;
}

function inspectManifest(cwd: string, issues: StrictMetadataIssue[]): void {
  let loaded: ReturnType<typeof loadManifest>;
  try {
    loaded = loadManifest({ cwd });
  } catch (error) {
    if (error instanceof ManifestError) {
      const prefix = error.path ? `${error.path}` : "bapm.yml";
      issues.push({ path: `${prefix}#/`, message: error.message });
      return;
    }
    throw error;
  }

  const document = loaded.document as unknown as Record<string, unknown>;
  const manifestPath = loaded.sourceFilename;

  if (!isNonEmptyString(document.name)) {
    issues.push({ path: `${manifestPath}#/name`, message: "must be a non-empty string" });
  }
  if (!isSemver(document.version)) {
    issues.push({
      path: `${manifestPath}#/version`,
      message: `must be semver 2.0.0 (got ${JSON.stringify(document.version)})`,
    });
  }

  inspectOptionalString(document, "description", `${manifestPath}#/description`, issues);
  inspectOptionalString(document, "license", `${manifestPath}#/license`, issues);
  inspectOptionalString(document, "repository", `${manifestPath}#/repository`, issues);
  inspectOptionalUrl(document, "homepage", `${manifestPath}#/homepage`, issues);

  const author = document.author;
  if (author !== undefined && !isNonEmptyString(author)) {
    issues.push({
      path: `${manifestPath}#/author`,
      message: "must be a non-empty string (OpenAPM manifest author)",
    });
  }

  inspectOptionalStringList(document, "keywords", `${manifestPath}#/keywords`, issues);
  inspectOptionalStringList(document, "tags", `${manifestPath}#/tags`, issues);
}

function inspectPluginJson(
  path: string,
  label: string,
  options: { agentPlugins: boolean },
  issues: StrictMetadataIssue[],
): void {
  let value: unknown;
  try {
    if (statSync(path).size > MAX_PLUGIN_JSON_BYTES) {
      issues.push({ path: label, message: `exceeds ${MAX_PLUGIN_JSON_BYTES} bytes` });
      return;
    }
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push({ path: label, message: `is not valid JSON: ${message}` });
    return;
  }

  if (!isPlainObject(value)) {
    issues.push({ path: label, message: "must contain a top-level JSON object" });
    return;
  }
  const document = value;

  if (options.agentPlugins) {
    if (document.$schema !== AGENT_PLUGIN_MANIFEST_SCHEMA_V1) {
      issues.push({
        path: `${label}#/$schema`,
        message: `must equal ${AGENT_PLUGIN_MANIFEST_SCHEMA_V1}`,
      });
    }
    if (!isNonEmptyString(document.name)) {
      issues.push({ path: `${label}#/name`, message: "must be a non-empty string" });
    } else if (!isValidPluginName(document.name)) {
      issues.push({
        path: `${label}#/name`,
        message: "must satisfy the Agent Plugins v1 naming rules (lowercase, 1-64 chars)",
      });
    }
  } else if (document.$schema !== undefined && !isNonEmptyString(document.$schema)) {
    issues.push({ path: `${label}#/$schema`, message: "must be a non-empty string" });
  }

  if (!options.agentPlugins && !isNonEmptyString(document.name)) {
    issues.push({ path: `${label}#/name`, message: "must be a non-empty string" });
  }

  if (document.version !== undefined) {
    if (!isNonEmptyString(document.version)) {
      issues.push({ path: `${label}#/version`, message: "must be a non-empty string" });
    } else if (!isSemver(document.version)) {
      issues.push({
        path: `${label}#/version`,
        message: `must be semver 2.0.0 (got ${JSON.stringify(document.version)})`,
      });
    }
  }

  inspectOptionalString(document, "description", `${label}#/description`, issues);
  inspectOptionalString(document, "license", `${label}#/license`, issues);
  inspectOptionalString(document, "repository", `${label}#/repository`, issues);
  inspectOptionalUrl(document, "homepage", `${label}#/homepage`, issues);
  inspectPluginAuthor(document.author, `${label}#/author`, issues);
  inspectOptionalStringList(document, "keywords", `${label}#/keywords`, issues);
}

function inspectPluginAuthor(value: unknown, path: string, issues: StrictMetadataIssue[]): void {
  if (value === undefined) return;
  if (isNonEmptyString(value)) return;
  if (!isPlainObject(value)) {
    issues.push({ path, message: "must be a string or an object with name/email/url" });
    return;
  }
  if (!isNonEmptyString(value.name)) {
    issues.push({ path: `${path}/name`, message: "must be a non-empty string" });
  }
  for (const field of ["email", "url"] as const) {
    if (value[field] !== undefined && !isNonEmptyString(value[field])) {
      issues.push({ path: `${path}/${field}`, message: "must be a non-empty string" });
    }
  }
}

function inspectMarketplacePackage(
  pkg: PackageEntry,
  path: string,
  issues: StrictMetadataIssue[],
): void {
  if (!isNonEmptyString(pkg.name)) {
    issues.push({ path: `${path}.name`, message: "must be a non-empty string" });
  }
  if (!isNonEmptyString(pkg.source)) {
    issues.push({ path: `${path}.source`, message: "must be a non-empty string" });
  }

  for (const field of ["description", "license", "repository", "homepage"] as const) {
    const value = pkg[field];
    if (value !== undefined && !isNonEmptyString(value)) {
      issues.push({ path: `${path}.${field}`, message: "must be a non-empty string" });
    }
  }
  if (pkg.homepage !== undefined && isNonEmptyString(pkg.homepage) && !isHttpUrl(pkg.homepage)) {
    issues.push({ path: `${path}.homepage`, message: "must be an http(s) URL" });
  }
  if (pkg.version !== undefined && !isNonEmptyString(pkg.version)) {
    issues.push({ path: `${path}.version`, message: "must be a non-empty string" });
  }
  if (pkg.author !== undefined && !isNonEmptyString(pkg.author)) {
    if (!isPlainObject(pkg.author)) {
      issues.push({
        path: `${path}.author`,
        message: "must be a string or an object with name/email/url",
      });
    }
  }
  for (const field of ["tags", "keywords"] as const) {
    const value = pkg[field];
    if (value !== undefined && !isStringArray(value)) {
      issues.push({ path: `${path}.${field}`, message: "must be an array of strings" });
    }
  }

  if (pkg.isLocal) return;

  // APM certifies remote metadata from the source apm.yml. bapm pack does not
  // fetch remote manifests, so only explicit fixed metadata is certifiable.
  if (!isNonEmptyString(pkg.description)) {
    issues.push({
      path: `${path}.description`,
      message: "remote marketplace package requires an explicit description for --strict-metadata",
    });
  }
  if (!isFixedVersion(pkg.version)) {
    issues.push({
      path: `${path}.version`,
      message:
        "remote marketplace package requires an explicit fixed display version (semver 2.0.0, no range) for --strict-metadata",
    });
  }
}

function inspectOptionalString(
  document: Record<string, unknown>,
  field: string,
  path: string,
  issues: StrictMetadataIssue[],
): void {
  const value = document[field];
  if (value !== undefined && !isNonEmptyString(value)) {
    issues.push({ path, message: "must be a non-empty string" });
  }
}

function inspectOptionalUrl(
  document: Record<string, unknown>,
  field: string,
  path: string,
  issues: StrictMetadataIssue[],
): void {
  const value = document[field];
  if (value === undefined) return;
  if (!isNonEmptyString(value)) {
    issues.push({ path, message: "must be a non-empty string" });
    return;
  }
  if (!isHttpUrl(value)) {
    issues.push({ path, message: "must be an http(s) URL" });
  }
}

function inspectOptionalStringList(
  document: Record<string, unknown>,
  field: string,
  path: string,
  issues: StrictMetadataIssue[],
): void {
  const value = document[field];
  if (value !== undefined && !isStringArray(value)) {
    issues.push({ path, message: "must be an array of strings" });
  }
}

function throwIfIssues(issues: StrictMetadataIssue[]): void {
  if (issues.length === 0) return;
  throw new PackError("PACK_METADATA", formatStrictMetadataIssues(issues), {
    details: { issues },
  });
}

function isRegularFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSemver(value: unknown): value is string {
  return typeof value === "string" && SEMVER_RE.test(value);
}

function isFixedVersion(value: unknown): value is string {
  return isSemver(value) && !VERSION_RANGE_RE.test(value);
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
