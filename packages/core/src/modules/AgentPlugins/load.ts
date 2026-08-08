import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, resolve, relative, sep } from "node:path";
import { AgentPluginsError } from "./errors.ts";
import {
  AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
  type AgentPluginDiagnostic,
  type AgentPluginManifest,
  type LoadedAgentPluginManifest,
  type LoadAgentPluginManifestOptions,
} from "./types.ts";

const TOP_LEVEL_FIELDS = new Set([
  "$schema",
  "name",
  "version",
  "description",
  "author",
  "homepage",
  "repository",
  "license",
  "keywords",
  "commands",
  "hooks",
  "extensions",
]);
const AUTHOR_FIELDS = new Set(["name", "email", "url"]);
const PLUGIN_NAME_RE = /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

/**
 * Load the portable v1 manifest from exactly `<root>/plugin.json`.
 * This is intentionally offline: `$schema` selects this local validator only.
 */
export function loadAgentPluginManifest(
  options: LoadAgentPluginManifestOptions,
): LoadedAgentPluginManifest {
  const requestedRoot = resolve(options.root);
  if (!existsSync(requestedRoot) || !statSync(requestedRoot).isDirectory()) {
    throw new AgentPluginsError(
      "AGENT_PLUGIN_ROOT_INVALID",
      `Agent Plugin root is not a directory: ${requestedRoot}`,
      { root: requestedRoot },
    );
  }

  const root = realpathSync(requestedRoot);
  const manifestCandidate = join(root, "plugin.json");
  if (!existsSync(manifestCandidate)) {
    throw new AgentPluginsError(
      "AGENT_PLUGIN_MANIFEST_INVALID",
      `Agent Plugin manifest not found: ${manifestCandidate}`,
      { root },
    );
  }

  let manifestPath: string;
  try {
    if (!statSync(manifestCandidate).isFile()) {
      throw new Error("not a regular file");
    }
    manifestPath = realpathSync(manifestCandidate);
  } catch (cause) {
    throw new AgentPluginsError(
      "AGENT_PLUGIN_MANIFEST_INVALID",
      `Agent Plugin manifest must be a regular file within the plugin root: ${manifestCandidate}`,
      { root, cause: cause instanceof Error ? cause.message : String(cause) },
    );
  }
  if (!isWithin(root, manifestPath)) {
    throw new AgentPluginsError(
      "AGENT_PLUGIN_MANIFEST_INVALID",
      `Agent Plugin manifest resolves outside the plugin root: ${manifestCandidate}`,
      { root, manifestPath },
    );
  }

  let value: unknown;
  try {
    value = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (cause) {
    throw new AgentPluginsError(
      "AGENT_PLUGIN_MANIFEST_INVALID",
      `Agent Plugin manifest is not valid JSON: ${manifestPath}`,
      { root, cause: cause instanceof Error ? cause.message : String(cause) },
    );
  }

  const { manifest, diagnostics } = validateAgentPluginManifest(value, manifestPath);
  return { root, manifestPath, manifest, diagnostics };
}

export function validateAgentPluginManifest(
  value: unknown,
  manifestPath = "plugin.json",
): { manifest: AgentPluginManifest; diagnostics: AgentPluginDiagnostic[] } {
  if (!isPlainObject(value)) {
    invalid(manifestPath, "must contain a top-level JSON object");
  }
  const document = value as Record<string, unknown>;
  const diagnostics: AgentPluginDiagnostic[] = [];

  for (const field of Object.keys(document)) {
    if (!TOP_LEVEL_FIELDS.has(field)) {
      diagnostics.push({
        code: "AGENT_PLUGIN_UNKNOWN_FIELD",
        message: `Ignoring unknown Agent Plugin manifest field "${field}"`,
        path: manifestPath,
        severity: "warning",
      });
    }
  }

  if (document.$schema !== AGENT_PLUGIN_MANIFEST_SCHEMA_V1) {
    invalid(manifestPath, `"${"$schema"}" must equal ${AGENT_PLUGIN_MANIFEST_SCHEMA_V1}`);
  }
  if (
    typeof document.name !== "string" ||
    !PLUGIN_NAME_RE.test(document.name) ||
    document.name.length > 64
  ) {
    invalid(manifestPath, '"name" must be a valid Agent Plugins v1 name');
  }

  for (const field of ["version", "description", "homepage", "repository", "license"] as const) {
    if (field in document && typeof document[field] !== "string") {
      invalid(manifestPath, `"${field}" must be a string`);
    }
  }
  if ("keywords" in document) {
    if (
      !Array.isArray(document.keywords) ||
      !document.keywords.every((item) => typeof item === "string")
    ) {
      invalid(manifestPath, '"keywords" must be an array of strings');
    }
  }
  if ("author" in document) validateAuthor(document.author, manifestPath);
  let manifestCommands: string[] | undefined;
  let manifestHooks: string[] | undefined;
  if ("commands" in document) {
    manifestCommands = requirePathList(document.commands, "commands", manifestPath);
  }
  if ("hooks" in document) {
    manifestHooks = requirePathList(document.hooks, "hooks", manifestPath);
  }
  if ("extensions" in document && !isPlainObject(document.extensions)) {
    diagnostics.push({
      code: "AGENT_PLUGIN_EXTENSIONS_IGNORED",
      message: 'Ignoring non-object "extensions" field',
      path: manifestPath,
      severity: "warning",
    });
  }

  const manifest: AgentPluginManifest = {
    $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
    name: document.name as string,
  };
  for (const field of ["version", "description", "homepage", "repository", "license"] as const) {
    if (typeof document[field] === "string") manifest[field] = document[field] as never;
  }
  if (Array.isArray(document.keywords)) manifest.keywords = document.keywords as string[];
  if (isPlainObject(document.author))
    manifest.author = document.author as AgentPluginManifest["author"];
  if (manifestCommands) manifest.commands = manifestCommands;
  if (manifestHooks) manifest.hooks = manifestHooks;
  if (isPlainObject(document.extensions)) {
    manifest.extensions = document.extensions as AgentPluginManifest["extensions"];
  }
  return { manifest, diagnostics };
}

export function isWithin(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep) && rel !== "..");
}

function validateAuthor(value: unknown, manifestPath: string): void {
  if (!isPlainObject(value)) invalid(manifestPath, '"author" must be an object');
  for (const [field, item] of Object.entries(value)) {
    if (!AUTHOR_FIELDS.has(field) || typeof item !== "string") {
      invalid(manifestPath, '"author" may contain only string name, email, and url fields');
    }
  }
}

function requirePathList(
  value: unknown,
  field: "commands" | "hooks",
  manifestPath: string,
): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    invalid(manifestPath, `"${field}" must be an array of path strings`);
  }
  return value as string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(path: string, reason: string): never {
  throw new AgentPluginsError(
    "AGENT_PLUGIN_MANIFEST_INVALID",
    `Invalid Agent Plugin manifest ${path}: ${reason}`,
    {
      path,
      reason,
    },
  );
}
