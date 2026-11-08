/**
 * Validated user-config keys. Adding a key here is the only way to make it
 * settable through `bapm config`; unknown keys are rejected before any write.
 */
import { accessSync, constants, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export type ConfigKeyId = "target" | "mcp-registry-url" | "temp-dir" | "self-update.channel";

export type ConfigKeyDefinition = {
  id: ConfigKeyId;
  /** JSON path inside `~/.bapm/config.json`. */
  path: string;
  /** Type shown in help / docs. */
  type: "target id" | "URL" | "path" | "stable | prerelease";
  /** Human-readable summary for help text. */
  summary: string;
  /** Effective fallback when the key is absent. */
  defaultValue?: string;
  /** Validate and normalize a CLI-supplied value. Throws on invalid input. */
  validate: (raw: string) => string;
};

const TARGET_ID_RE = /^[a-z0-9][a-z0-9._-]*$/;
const MCP_REGISTRY_URL_MAX_LENGTH = 2048;
const SELF_UPDATE_CHANNELS = new Set(["stable", "prerelease"]);

function hasControlCharacters(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0)!;
    if (code < 32 || code === 127) return true;
  }
  return false;
}

function validateTarget(raw: string): string {
  const value = raw.trim();
  if (!value || !TARGET_ID_RE.test(value)) {
    throw new Error(
      `Invalid target id "${raw}": expected lowercase letters, digits, ".", "_", or "-"`,
    );
  }
  return value;
}

function validateMcpRegistryUrl(raw: string): string {
  const value = raw.trim().replace(/\/+$/, "");
  if (!value) {
    throw new Error("mcp-registry-url cannot be empty");
  }
  if (value.length > MCP_REGISTRY_URL_MAX_LENGTH) {
    throw new Error(
      `mcp-registry-url is too long (${value.length} > ${MCP_REGISTRY_URL_MAX_LENGTH} characters)`,
    );
  }
  if (hasControlCharacters(value)) {
    throw new Error("mcp-registry-url must be a single URL without control characters");
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `Invalid mcp-registry-url "${value}": expected an http:// or https:// URL with a host`,
    );
  }

  const scheme = parsed.protocol.replace(/:$/, "").toLowerCase();
  if (scheme !== "http" && scheme !== "https") {
    throw new Error(
      `Invalid mcp-registry-url scheme "${scheme}": use http:// or https:// (ws/wss and file:// are rejected)`,
    );
  }
  if (parsed.username || parsed.password) {
    throw new Error("mcp-registry-url must not contain embedded credentials");
  }
  if (!parsed.hostname) {
    throw new Error(`Invalid mcp-registry-url "${value}": expected an http(s) URL with a host`);
  }
  if (parsed.search || parsed.hash) {
    throw new Error("mcp-registry-url must not contain a query string or fragment");
  }
  return value;
}

function expandHome(value: string): string {
  if (value === "~") return homedir();
  if (value.startsWith("~/") || value.startsWith("~\\")) {
    return join(homedir(), value.slice(2));
  }
  return value;
}

function validateTempDir(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("temp-dir cannot be empty");
  }
  if (hasControlCharacters(trimmed)) {
    throw new Error("temp-dir must be a single filesystem path");
  }
  const resolved = resolve(expandHome(trimmed));

  let stats;
  try {
    stats = statSync(resolved);
  } catch {
    throw new Error(`temp-dir does not exist: ${resolved}`);
  }
  if (!stats.isDirectory()) {
    throw new Error(`temp-dir is not a directory: ${resolved}`);
  }
  try {
    accessSync(resolved, constants.W_OK);
  } catch {
    throw new Error(`temp-dir is not writable: ${resolved}`);
  }
  return resolved;
}

function validateSelfUpdateChannel(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (!SELF_UPDATE_CHANNELS.has(value)) {
    throw new Error(`Invalid self-update.channel "${raw}": expected "stable" or "prerelease"`);
  }
  return value;
}

export const CONFIG_KEY_DEFINITIONS: readonly ConfigKeyDefinition[] = [
  {
    id: "target",
    path: "target",
    type: "target id",
    summary: "Default host target before sole auto-detection",
    validate: validateTarget,
  },
  {
    id: "mcp-registry-url",
    path: "mcp-registry-url",
    type: "URL",
    summary: "Stored private MCP registry base URL (no registry lookup consumer yet)",
    validate: validateMcpRegistryUrl,
  },
  {
    id: "temp-dir",
    path: "temp-dir",
    type: "path",
    summary: "Stored absolute temp directory (existing, writable; not consumed yet)",
    validate: validateTempDir,
  },
  {
    id: "self-update.channel",
    path: "self-update.channel",
    type: "stable | prerelease",
    summary: "Stored self-update channel preference (stable default; not consumed yet)",
    defaultValue: "stable",
    validate: validateSelfUpdateChannel,
  },
];

export function findConfigKey(key: string): ConfigKeyDefinition | undefined {
  return CONFIG_KEY_DEFINITIONS.find((definition) => definition.id === key);
}

export function configKeyIds(): string {
  return CONFIG_KEY_DEFINITIONS.map((definition) => definition.id).join(", ");
}

export function unknownConfigKeyMessage(key: string): string {
  return `Unknown config key "${key}". Valid keys: ${configKeyIds()}`;
}

export function validateConfigValue(
  key: string,
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const definition = findConfigKey(key);
  if (!definition) {
    return { ok: false, error: unknownConfigKeyMessage(key) };
  }
  try {
    return { ok: true, value: definition.validate(raw) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
