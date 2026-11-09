/**
 * Shared MCP env-reference handling for host integrations.
 *
 * The portable contract accepts several authored placeholder forms. Hosts
 * translate them into their native runtime form without baking secrets.
 */

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ConfigureMcpReport, TargetId } from "./types.ts";
import { pruneManagedMcpServerNames } from "./helpers.ts";

/** Native placeholder syntax a host resolves at runtime. */
export type EnvReferenceStyle = "dollar-env" | "brace-env" | "dollar-bare";

const ENV_REFERENCE_PATTERN =
  /\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}|\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\{env:([A-Za-z_][A-Za-z0-9_]*)\}|<([A-Z_][A-Z0-9_]*)>/g;

const SINGLE_ENV_REFERENCE_PATTERN =
  /^\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}$|^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$|^\{env:([A-Za-z_][A-Za-z0-9_]*)\}$|^<([A-Z_][A-Z0-9_]*)>$/;

function renderReference(name: string, style: EnvReferenceStyle): string {
  if (style === "dollar-env") return `\${env:${name}}`;
  if (style === "brace-env") return `{env:${name}}`;
  return `\${${name}}`;
}

/**
 * Translate every authored env placeholder in `value` to `style`.
 * Literal text and unknown placeholders are preserved.
 */
export function translateEnvReferences(value: string, style: EnvReferenceStyle): string {
  return value.replace(
    ENV_REFERENCE_PATTERN,
    (_match, dollarEnv: string, dollarBare: string, braceEnv: string, angle: string) =>
      renderReference(dollarEnv ?? dollarBare ?? braceEnv ?? angle, style),
  );
}

/** Translate a string map, preserving non-string values as strings. */
export function translateEnvMap(
  values: Record<string, string>,
  style: EnvReferenceStyle,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(values)) {
    out[key] = typeof raw === "string" ? translateEnvReferences(raw, style) : String(raw);
  }
  return out;
}

/**
 * True when the value contains an authored env reference prefix.
 *
 * Deliberately broad: malformed references such as `${TOKEN-WITH-DASH}` must
 * still enter the host's fail-closed decision path instead of being written as
 * a static value.
 */
export function hasEnvReference(value: string): boolean {
  return /\$\{|<[A-Z_][A-Z0-9_]*>|\{env:[A-Za-z_][A-Za-z0-9_]*\}/.test(value);
}

/** Extract a single env reference name when the whole value is one placeholder. */
export function extractEnvReference(value: string): string | undefined {
  const match = SINGLE_ENV_REFERENCE_PATTERN.exec(value);
  return match ? (match[1] ?? match[2] ?? match[3] ?? match[4]) : undefined;
}

/** Normalize an array or name-keyed record to a list with non-empty names. */
export function normalizeNamedEntries<T extends { name?: string }>(
  input: T[] | Record<string, T>,
): Array<T & { name: string }> {
  const list: T[] = Array.isArray(input)
    ? input
    : Object.entries(input).map(([name, value]) => ({ ...value, name: value.name ?? name }));

  const out: Array<T & { name: string }> = [];
  for (const entry of list) {
    const name = String(entry.name ?? "").trim();
    if (!name) continue;
    out.push({ ...entry, name });
  }
  return out;
}

export type MergeMcpServersArgs = {
  document: Record<string, unknown>;
  /** Document key holding the server map; default `mcpServers`. */
  key?: string;
  incoming: Record<string, Record<string, unknown>>;
  managedServers?: readonly string[];
  /** `replace` overwrites prior entries; `shallow` merges prior + incoming. */
  merge?: "replace" | "shallow";
  /** Adapter-only keys removed after merge. */
  stripKeys?: readonly string[];
};

export type MergeMcpServersResult = {
  document: Record<string, unknown>;
  servers: string[];
  removed: string[];
};

/**
 * Merge incoming MCP entries into a document section, pruning bapm-managed
 * names that are no longer approved while leaving foreign entries untouched.
 */
export function mergeMcpServers(args: MergeMcpServersArgs): MergeMcpServersResult {
  const key = args.key ?? "mcpServers";
  const current =
    args.document[key] &&
    typeof args.document[key] === "object" &&
    !Array.isArray(args.document[key])
      ? { ...(args.document[key] as Record<string, Record<string, unknown>>) }
      : {};

  const removed = pruneManagedMcpServerNames(
    current,
    Object.keys(args.incoming),
    args.managedServers,
  );

  const strip = new Set(args.stripKeys ?? []);
  const servers: string[] = [];
  for (const [name, entry] of Object.entries(args.incoming)) {
    const prior = current[name];
    const merged =
      args.merge === "shallow" && prior && typeof prior === "object" && !Array.isArray(prior)
        ? { ...prior, ...entry }
        : { ...entry };
    for (const keyToStrip of strip) delete merged[keyToStrip];
    current[name] = merged;
    servers.push(name);
  }

  return {
    document: { ...args.document, [key]: current },
    servers,
    removed,
  };
}

export type SkipMcpWhenDirMissingArgs = {
  cwd: string;
  /** Project-relative host directory, e.g. `.kiro`. */
  dir: string;
  targetId?: TargetId;
  code: string;
  /** Human-readable host label used in the diagnostic. */
  label: string;
  configPath: string;
};

/**
 * Return the standard opt-in skip report when a host directory is absent.
 * `undefined` means the directory exists and the host may write MCP config.
 */
export function skipMcpWhenDirMissing(
  args: SkipMcpWhenDirMissingArgs,
): ConfigureMcpReport | undefined {
  const dirPath = join(args.cwd, args.dir);
  if (existsSync(dirPath) && statSync(dirPath).isDirectory()) return undefined;
  const dirLabel = args.dir.endsWith("/") ? args.dir : `${args.dir}/`;
  return {
    targetId: args.targetId,
    configPath: args.configPath,
    servers: [],
    deployedFiles: [],
    diagnostics: [
      {
        code: args.code,
        message: `Skipping project MCP write for ${args.label}: ${dirLabel} directory is absent (${args.label} project-scope MCP is opt-in; create ${dirLabel} and re-run install)`,
        target: args.targetId,
        dir: dirLabel,
        warn: true,
      },
    ],
  };
}

export type MergeLspServersArgs = {
  document: Record<string, unknown>;
  /** Document key holding the LSP server map; default `lspServers`. */
  key?: string;
  incoming: Record<string, Record<string, unknown>>;
  managedServers?: readonly string[];
  /** Label used in ownership errors, e.g. `CLAUDE_LSP_OWNERSHIP`. */
  ownershipLabel?: string;
  /** Path shown in ownership errors; defaults to the key. */
  pathLabel?: string;
};

export type MergeLspServersResult = {
  document: Record<string, unknown>;
  servers: string[];
};

/**
 * Merge LSP entries, refusing to overwrite a foreign server whose content
 * differs while still allowing bapm-managed entries to update.
 */
export function mergeLspServers(args: MergeLspServersArgs): MergeLspServersResult {
  const key = args.key ?? "lspServers";
  const current =
    args.document[key] &&
    typeof args.document[key] === "object" &&
    !Array.isArray(args.document[key])
      ? { ...(args.document[key] as Record<string, Record<string, unknown>>) }
      : {};

  const managed = new Set(args.managedServers ?? []);
  pruneManagedMcpServerNames(current, Object.keys(args.incoming), args.managedServers);

  for (const [name, entry] of Object.entries(args.incoming)) {
    const prior = current[name];
    if (prior && !managed.has(name) && JSON.stringify(prior) !== JSON.stringify(entry)) {
      const label = args.ownershipLabel ?? "LSP_OWNERSHIP";
      const pathLabel = args.pathLabel ?? key;
      throw new Error(
        `${label}: LSP server '${name}' already exists in ${pathLabel} and is not managed by bapm; rename it or remove it`,
      );
    }
    current[name] = entry;
  }

  return { document: { ...args.document, [key]: current }, servers: Object.keys(args.incoming) };
}
