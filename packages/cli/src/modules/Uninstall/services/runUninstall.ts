import { runUninstall as coreRunUninstall } from "@bapm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type UninstallOptions = { args?: string[]; cwd?: string };

export function parseUninstallArgs(argv: string[]): {
  dryRun: boolean;
  packages: string[];
  help?: boolean;
  error?: string;
} {
  let dryRun = false;
  let help = false;
  const packages: string[] = [];
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg.startsWith("-")) {
      return { dryRun, packages, error: `Unknown uninstall flag: ${arg}` };
    }
    packages.push(arg);
  }
  return { dryRun, packages, help };
}

export function formatUninstallHelp(deps: LifecycleCliDeps): string {
  return `${deps.name} uninstall — Remove packages from manifest, modules, lock

Usage:
  bapm uninstall <packages...> [--dry-run]
`;
}

export async function runUninstallCli(
  deps: LifecycleCliDeps,
  options: UninstallOptions,
): Promise<LifecycleResult> {
  const parsed = parseUninstallArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatUninstallHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, exitCode: 1, message: parsed.error };
  }
  try {
    const result = await coreRunUninstall({
      cwd: options.cwd,
      packages: parsed.packages,
      dryRun: parsed.dryRun,
    });
    if (result.text) console.log(result.text);
    return { ok: result.ok, exitCode: result.exitCode };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
}
