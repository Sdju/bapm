import { persistUserExecutableGrant, type SaveUserExecutableGrantsOptions } from "@b-apm/core";
import type { LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type ApproveCliDeps = {
  name: string;
  manifestFile: string;
  /** Injectable save for tests; defaults to core user-store. */
  saveGrant?: (opts: SaveUserExecutableGrantsOptions) => unknown;
};

export const APPROVE_EXECUTABLE_TYPES = ["mcp", "bin", "hook"] as const;
export type ApproveExecutableType = (typeof APPROVE_EXECUTABLE_TYPES)[number];

export function formatApproveHelp(deps: ApproveCliDeps): string {
  return `${deps.name} approve — Persist user-local executable allow

Usage:
  bapm approve <package-name> [--bin|--hook|--mcp] [--user]

Persists an allow grant under ~/.bapm/config.json (executables.allow).
  --mcp    approve MCP servers (default)
  --bin    approve dependency bin/ executables
  --hook   approve dependency hooks
Multiple type flags persist each selected type. With no type flag, approve
defaults to --mcp (backward compatible).
Interactive approve NEVER writes project ${deps.manifestFile}.
`;
}

export function parseApproveArgs(argv: string[]): {
  help: boolean;
  packageName?: string;
  user: boolean;
  executableTypes: ApproveExecutableType[];
} {
  let help = false;
  const positionals: string[] = [];
  const executableTypes: ApproveExecutableType[] = [];
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
      const type = arg.slice(2) as ApproveExecutableType;
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

export async function runApproveCli(
  deps: ApproveCliDeps,
  options: { args?: string[]; cwd?: string } = {},
): Promise<LifecycleResult> {
  const parsed = parseApproveArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatApproveHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  const packageName = parsed.packageName?.trim();
  if (!packageName) {
    console.error(`${deps.name}: approve requires a package name`);
    console.log(formatApproveHelp(deps));
    return { ok: false, exitCode: 1 };
  }

  const save = deps.saveGrant ?? persistUserExecutableGrant;
  for (const executableType of parsed.executableTypes) {
    save({
      packageName,
      grant: "allow",
      executableType,
    });
  }
  console.log(
    `Approved "${packageName}" (${parsed.executableTypes.join(", ")}) in user config (~/.bapm/config.json)`,
  );
  return { ok: true, exitCode: 0 };
}
