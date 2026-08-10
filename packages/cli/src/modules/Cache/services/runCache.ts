import { cacheClean, cacheInfo } from "@b-apm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type CacheOptions = { args?: string[]; cwd?: string };

export function parseCacheArgs(argv: string[]): {
  subcommand?: "info" | "clean";
  yes: boolean;
  dryRun: boolean;
  help?: boolean;
  error?: string;
} {
  let subcommand: "info" | "clean" | undefined;
  let yes = false;
  let dryRun = false;

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      return { subcommand, yes, dryRun, help: true };
    }
    if (arg === "-y" || arg === "--yes") {
      yes = true;
      continue;
    }
    if (arg === "--dry-run") {
      if (subcommand && subcommand !== "clean") {
        return {
          subcommand,
          yes,
          dryRun,
          error: `Unsupported cache flag on ${subcommand}: --dry-run`,
        };
      }
      dryRun = true;
      continue;
    }
    if (arg.startsWith("-")) {
      return { subcommand, yes, dryRun, error: `Unknown cache flag: ${arg}` };
    }
    if (arg === "info" || arg === "clean") {
      if (subcommand) {
        return { subcommand, yes, dryRun, error: `Unexpected cache argument: ${arg}` };
      }
      subcommand = arg;
      continue;
    }
    return { subcommand, yes, dryRun, error: `Unknown cache subcommand: ${arg}` };
  }

  if (!subcommand) {
    return { yes, dryRun, error: "Usage: bapm cache <info|clean> [-y] [--dry-run]" };
  }
  if (dryRun && subcommand !== "clean") {
    return { subcommand, yes, dryRun, error: `Unsupported cache flag on ${subcommand}: --dry-run` };
  }
  return { subcommand, yes, dryRun };
}

export function formatCacheHelp(deps: LifecycleCliDeps): string {
  return `${deps.name} cache — Modules-cache (apm_modules) info and clean

Usage:
  bapm cache info
  bapm cache clean [-y|--yes] [--dry-run]

Options:
  -y, --yes    Confirm clean without interactive prompt
  --dry-run    Preview clean without deleting (no -y required)
  --help, -h   Show this help

Operates on the project modules-cache root (apm_modules). Does not use a shared
APM git/http cache. After clean, re-run install/lock to repopulate.
`;
}

export async function runCacheCli(
  deps: LifecycleCliDeps,
  options: CacheOptions,
): Promise<LifecycleResult> {
  const parsed = parseCacheArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatCacheHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, exitCode: 1, message: parsed.error };
  }

  try {
    if (parsed.subcommand === "info") {
      const info = cacheInfo({ cwd: options.cwd });
      console.log(info.text);
      return { ok: true, exitCode: 0 };
    }

    const result = cacheClean({
      cwd: options.cwd,
      yes: parsed.yes,
      dryRun: parsed.dryRun,
    });
    if (result.refused) {
      console.error(`${deps.name}: ${result.message}`);
      return { ok: false, exitCode: 1, message: result.message };
    }
    console.log(result.message);
    return { ok: result.ok, exitCode: result.ok ? 0 : 1 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
}
