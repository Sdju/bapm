import { persistUserExecutableGrant, type SaveUserExecutableGrantsOptions } from "@b-apm/core";
import type { LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type DenyCliDeps = {
  name: string;
  manifestFile: string;
  saveGrant?: (opts: SaveUserExecutableGrantsOptions) => unknown;
};

export const DENY_EXECUTABLE_TYPES = ["mcp", "bin", "hook"] as const;
export type DenyExecutableType = (typeof DENY_EXECUTABLE_TYPES)[number];

export function formatDenyHelp(deps: DenyCliDeps): string {
  return `${deps.name} deny — Persist user-local executable deny

Usage:
  bapm deny <package-name> [--bin|--hook|--mcp] [--user]

Persists a deny under ~/.bapm/config.json (executables.deny).
  --mcp    deny MCP servers (default)
  --bin    deny dependency bin/ executables
  --hook   deny dependency hooks
Multiple type flags persist each selected type. With no type flag, deny
defaults to --mcp (backward compatible).
Interactive deny NEVER writes project ${deps.manifestFile}.
`;
}

export function parseDenyArgs(argv: string[]): {
  help: boolean;
  packageName?: string;
  user: boolean;
  executableTypes: DenyExecutableType[];
} {
  let help = false;
  const positionals: string[] = [];
  const executableTypes: DenyExecutableType[] = [];
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--user") {
      // Interactive path is always user-local (sc-010); flag accepted for APM parity.
      continue;
    }
    if (arg === "--mcp" || arg === "--bin" || arg === "--hook") {
      const type = arg.slice(2) as DenyExecutableType;
      if (!executableTypes.includes(type)) executableTypes.push(type);
      continue;
    }
    if (arg.startsWith("-")) continue;
    positionals.push(arg);
  }
  return {
    help,
    packageName: positionals[0],
    user: true,
    executableTypes: executableTypes.length > 0 ? executableTypes : ["mcp"],
  };
}

export async function runDenyCli(
  deps: DenyCliDeps,
  options: { args?: string[]; cwd?: string } = {},
): Promise<LifecycleResult> {
  const parsed = parseDenyArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatDenyHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  const packageName = parsed.packageName?.trim();
  if (!packageName) {
    console.error(`${deps.name}: deny requires a package name`);
    console.log(formatDenyHelp(deps));
    return { ok: false, exitCode: 1 };
  }

  const save = deps.saveGrant ?? persistUserExecutableGrant;
  for (const executableType of parsed.executableTypes) {
    save({
      packageName,
      grant: "deny",
      executableType,
    });
  }
  console.log(
    `Denied "${packageName}" (${parsed.executableTypes.join(", ")}) in user config (~/.bapm/config.json)`,
  );
  return { ok: true, exitCode: 0 };
}
