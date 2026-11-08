import { persistUserExecutableGrant, type SaveUserExecutableGrantsOptions } from "@b-apm/core";
import type { LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type ApproveCliDeps = {
  name: string;
  manifestFile: string;
  /** Injectable save for tests; defaults to core user-store. */
  saveGrant?: (opts: SaveUserExecutableGrantsOptions) => unknown;
};

export function formatApproveHelp(deps: ApproveCliDeps): string {
  return `${deps.name} approve — Persist user-local executable allow

Usage:
  bapm approve <package-name> [--hook] [--user]

Persists an MCP allow grant under ~/.bapm/config.json (executables.allow).
Pass --hook to persist a hook grant (executables.allow.<pkg>.hook: true).
Interactive approve NEVER writes project ${deps.manifestFile}.
`;
}

export function parseApproveArgs(argv: string[]): {
  help: boolean;
  packageName?: string;
  user: boolean;
  executableType: "mcp" | "hook";
} {
  let help = false;
  let executableType: "mcp" | "hook" = "mcp";
  const positionals: string[] = [];
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--hook") {
      executableType = "hook";
      continue;
    }
    if (arg === "--user") {
      // Interactive path is always user-local (sc-010); flag accepted for APM parity.
      continue;
    }
    if (arg.startsWith("-")) continue;
    positionals.push(arg);
  }
  return { help, packageName: positionals[0], user: true, executableType };
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
  save({
    packageName,
    grant: "allow",
    executableType: parsed.executableType,
  });
  console.log(
    `Approved "${packageName}" (${parsed.executableType}) in user config (~/.bapm/config.json)`,
  );
  return { ok: true, exitCode: 0 };
}
