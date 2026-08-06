import { persistUserExecutableGrant, type SaveUserExecutableGrantsOptions } from "@bapm/core";
import type { LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type DenyCliDeps = {
  name: string;
  manifestFile: string;
  saveGrant?: (opts: SaveUserExecutableGrantsOptions) => unknown;
};

export function formatDenyHelp(deps: DenyCliDeps): string {
  return `${deps.name} deny — Persist user-local executable deny (sc-010)

Usage:
  bapm deny <package-name> [--user]

Persists an MCP deny under ~/.bapm/config.json (executables.deny).
Interactive deny NEVER writes project ${deps.manifestFile}.
`;
}

export function parseDenyArgs(argv: string[]): {
  help: boolean;
  packageName?: string;
  user: boolean;
} {
  let help = false;
  const positionals: string[] = [];
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--user") {
      // Interactive path is always user-local (sc-010); flag accepted for APM parity.
      continue;
    }
    if (arg.startsWith("-")) continue;
    positionals.push(arg);
  }
  return { help, packageName: positionals[0], user: true };
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
  save({
    packageName,
    grant: "deny",
    executableType: "mcp",
  });
  console.log(`Denied "${packageName}" (mcp) in user config (~/.bapm/config.json)`);
  return { ok: true, exitCode: 0 };
}
