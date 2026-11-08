import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";
import {
  CONFIG_KEY_DEFINITIONS,
  findConfigKey,
  unknownConfigKeyMessage,
  validateConfigValue,
} from "../keys.ts";
import {
  getConfigValue,
  loadUserConfig,
  setConfigValue,
  unsetConfigValue,
  userConfigPath,
  writeUserConfig,
  type UserConfigDocument,
  type UserConfigStoreOptions,
} from "../store.ts";

export type ConfigCliDeps = LifecycleCliDeps & {
  /** Override `~/.bapm` (tests / embedders). */
  configRoot?: string;
};

export type ConfigOptions = { args?: string[]; cwd?: string };

export type ParsedConfigArgs = {
  sub: "get" | "list" | "set" | "unset" | "help";
  key?: string;
  value?: string;
  json?: boolean;
  error?: string;
};

function keyLines(): string {
  return CONFIG_KEY_DEFINITIONS.map(
    (definition) => `  ${definition.id.padEnd(20)} ${definition.summary}`,
  ).join("\n");
}

export function formatConfigHelp(deps: ConfigCliDeps): string {
  return `${deps.name} config — Inspect or update user defaults (~/.bapm/config.json)

Usage:
  bapm config
  bapm config list [--json]
  bapm config get <key>
  bapm config set <key> <value>
  bapm config unset <key>

Keys:
${keyLines()}

Value rules:
  target                Lowercase id: letters, digits, ".", "_", "-" (e.g. cursor)
  mcp-registry-url      http:// or https:// URL with a host; no credentials/query/fragment
  temp-dir              Existing, writable directory (stored absolute; ~ is expanded)
  self-update.channel   "stable" (default) or "prerelease"

Options:
  --json         Machine-readable list output
  --help, -h     Show this help

Notes:
  Unknown keys are rejected. mcp-registry-url, temp-dir, and self-update.channel are
  currently stored-only: no install/MCP lookup/self-update consumer reads them yet.
  Read-merge-write preserves existing keys, including executables.allow/deny grants
  written by bapm approve / bapm deny. Writes are atomic (temp file + rename).
  Host selection precedence: --target → local overlay active → manifest active →
  config target → sole auto-detect → fail.
`;
}

export function parseConfigArgs(argv: string[]): ParsedConfigArgs {
  if (argv.length === 0) return { sub: "list" };
  const [first, ...rest] = argv;
  if (first === "--help" || first === "-h") return { sub: "help" };
  if (first === "--json") return { sub: "list", json: true };
  if (first !== "get" && first !== "list" && first !== "set" && first !== "unset") {
    return { sub: "help", error: `Unknown config subcommand: ${first}` };
  }

  let json = false;
  const positionals: string[] = [];
  for (const arg of rest) {
    if (arg === "--help" || arg === "-h") return { sub: "help" };
    if (arg === "--json") {
      if (first !== "list") {
        return { sub: first, error: `Unsupported config flag on ${first}: --json` };
      }
      json = true;
      continue;
    }
    if (arg.startsWith("-")) {
      return { sub: first, error: `Unknown config flag: ${arg}` };
    }
    positionals.push(arg);
  }

  if (first === "list") {
    if (positionals.length > 0) {
      return { sub: first, error: `Unexpected config list argument: ${positionals[0]}` };
    }
    return { sub: "list", json };
  }

  if (first === "get") {
    if (positionals.length !== 1) {
      return { sub: "get", error: "Usage: bapm config get <key>" };
    }
    const key = positionals[0]!;
    if (!findConfigKey(key)) {
      return { sub: "get", key, error: unknownConfigKeyMessage(key) };
    }
    return { sub: "get", key };
  }

  if (first === "set") {
    if (positionals.length !== 2) {
      return { sub: "set", error: "Usage: bapm config set <key> <value>" };
    }
    const [key, raw] = positionals as [string, string];
    if (!findConfigKey(key)) {
      return { sub: "set", key, error: unknownConfigKeyMessage(key) };
    }
    const parsed = validateConfigValue(key, raw);
    if (!parsed.ok) {
      return { sub: "set", key, value: raw, error: parsed.error };
    }
    return { sub: "set", key, value: parsed.value };
  }

  if (positionals.length !== 1) {
    return { sub: "unset", error: "Usage: bapm config unset <key>" };
  }
  const key = positionals[0]!;
  if (!findConfigKey(key)) {
    return { sub: "unset", key, error: unknownConfigKeyMessage(key) };
  }
  return { sub: "unset", key };
}

function shapeForJson(document: UserConfigDocument): Record<string, unknown> {
  const knownRoots = new Set(
    CONFIG_KEY_DEFINITIONS.map((definition) => definition.path.split(".")[0]),
  );
  const shaped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(document)) {
    if (!knownRoots.has(key)) shaped[key] = value;
  }
  for (const definition of CONFIG_KEY_DEFINITIONS) {
    const value = getConfigValue(document, definition.path);
    shaped[definition.id] = typeof value === "string" ? value : null;
  }
  return shaped;
}

function grantSummary(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "0";
  return String(Object.keys(value as Record<string, unknown>).length);
}

function printList(deps: ConfigCliDeps, document: UserConfigDocument): void {
  for (const definition of CONFIG_KEY_DEFINITIONS) {
    const value = getConfigValue(document, definition.path);
    const rendered =
      typeof value === "string"
        ? value
        : definition.defaultValue
          ? `${definition.defaultValue} (default)`
          : "(unset)";
    console.log(`${definition.id}\t${rendered}`);
  }
  const executables =
    document.executables && typeof document.executables === "object"
      ? (document.executables as Record<string, unknown>)
      : {};
  console.log(`executables.allow\t${grantSummary(executables.allow)}`);
  console.log(`executables.deny\t${grantSummary(executables.deny)}`);
  console.log(
    `path\t${userConfigPath(deps.configRoot ? { configRoot: deps.configRoot } : undefined)}`,
  );
}

export async function runConfigCli(
  deps: ConfigCliDeps,
  options: ConfigOptions = {},
): Promise<LifecycleResult> {
  const parsed = parseConfigArgs(options.args ?? []);
  if (parsed.sub === "help") {
    if (parsed.error) {
      console.error(`${deps.name}: ${parsed.error}`);
      console.log(formatConfigHelp(deps));
      return { ok: false, exitCode: 1, message: parsed.error };
    }
    console.log(formatConfigHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, exitCode: 1, message: parsed.error };
  }

  const storeOptions: UserConfigStoreOptions = deps.configRoot
    ? { configRoot: deps.configRoot }
    : {};

  if (parsed.sub === "list") {
    const document = loadUserConfig(storeOptions);
    if (parsed.json) {
      console.log(JSON.stringify(shapeForJson(document), null, 2));
    } else {
      printList(deps, document);
    }
    return { ok: true, exitCode: 0 };
  }

  if (parsed.sub === "get") {
    const document = loadUserConfig(storeOptions);
    const value = getConfigValue(document, parsed.key!);
    if (value === undefined) {
      const message = `config key "${parsed.key}" is not set`;
      console.error(`${deps.name}: ${message}`);
      return { ok: false, exitCode: 1, message };
    }
    if (typeof value === "string") {
      console.log(value);
    } else {
      console.log(JSON.stringify(value, null, 2));
    }
    return { ok: true, exitCode: 0 };
  }

  if (parsed.sub === "set") {
    const document = loadUserConfig(storeOptions);
    const next = setConfigValue(document, parsed.key!, parsed.value);
    writeUserConfig(next, storeOptions);
    console.log(`Set ${parsed.key} = ${parsed.value} in ${userConfigPath(storeOptions)}`);
    return { ok: true, exitCode: 0 };
  }

  const document = loadUserConfig(storeOptions);
  const next = unsetConfigValue(document, parsed.key!);
  writeUserConfig(next, storeOptions);
  console.log(`Unset ${parsed.key} in ${userConfigPath(storeOptions)}`);
  return { ok: true, exitCode: 0 };
}
