import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";
import {
  getConfigValue,
  loadUserConfig,
  readConfiguredTarget,
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

const TARGET_KEY = "target";
const TARGET_ID_RE = /^[a-z0-9][a-z0-9._-]*$/;

export function formatConfigHelp(deps: ConfigCliDeps): string {
  return `${deps.name} config — Inspect or update user defaults (~/.bapm/config.json)

Usage:
  bapm config
  bapm config list [--json]
  bapm config get <key>
  bapm config set target <id>
  bapm config unset target

Keys:
  target         Default host target when --target, active, and auto-detect yield nothing

Options:
  --json         Machine-readable list output
  --help, -h     Show this help

Notes:
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
    return { sub: "get", key: positionals[0] };
  }

  if (first === "set") {
    if (positionals.length !== 2) {
      return { sub: "set", error: "Usage: bapm config set target <id>" };
    }
    const [key, value] = positionals as [string, string];
    if (key !== TARGET_KEY) {
      return { sub: "set", key, error: `config set only supports "${TARGET_KEY}" (got "${key}")` };
    }
    const target = value.trim();
    if (!target || !TARGET_ID_RE.test(target)) {
      return { sub: "set", key, value, error: `Invalid target id "${value}"` };
    }
    return { sub: "set", key, value: target };
  }

  if (positionals.length !== 1) {
    return { sub: "unset", error: "Usage: bapm config unset target" };
  }
  const key = positionals[0]!;
  if (key !== TARGET_KEY) {
    return {
      sub: "unset",
      key,
      error: `config unset only supports "${TARGET_KEY}" (got "${key}")`,
    };
  }
  return { sub: "unset", key };
}

function shapeForJson(document: UserConfigDocument): Record<string, unknown> {
  return {
    target: typeof document.target === "string" ? document.target : null,
    ...Object.fromEntries(Object.entries(document).filter(([key]) => key !== "target")),
  };
}

function grantSummary(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "0";
  return String(Object.keys(value as Record<string, unknown>).length);
}

function printList(deps: ConfigCliDeps, document: UserConfigDocument): void {
  const target = readConfiguredTarget(
    deps.configRoot ? { configRoot: deps.configRoot } : undefined,
  );
  console.log(`${TARGET_KEY}\t${target ?? "(unset)"}`);
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
