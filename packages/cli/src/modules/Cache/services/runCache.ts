import {
  cacheClean,
  cacheInfo,
  pruneSharedCache,
  sharedGitCacheClean,
  sharedGitCacheInfo,
} from "@b-apm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type CacheOptions = { args?: string[]; cwd?: string };

export type CacheSubcommand = "info" | "clean" | "prune";

export type ParsedCacheArgs = {
  subcommand?: CacheSubcommand;
  yes: boolean;
  dryRun: boolean;
  shared: boolean;
  json: boolean;
  days?: number;
  help?: boolean;
  error?: string;
};

export function parseCacheArgs(argv: string[]): ParsedCacheArgs {
  let subcommand: CacheSubcommand | undefined;
  let yes = false;
  let dryRun = false;
  let shared = false;
  let json = false;
  let days: number | undefined;

  const state = (): Pick<
    ParsedCacheArgs,
    "subcommand" | "yes" | "dryRun" | "shared" | "json" | "days"
  > => ({ subcommand, yes, dryRun, shared, json, days });

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--help" || arg === "-h") {
      return { ...state(), help: true };
    }
    if (arg === "-y" || arg === "--yes") {
      yes = true;
      continue;
    }
    if (arg === "--shared") {
      shared = true;
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--days" || arg.startsWith("--days=")) {
      const raw = arg === "--days" ? argv[index + 1] : arg.slice("--days=".length);
      if (arg === "--days") index += 1;
      const parsed = parseDays(raw);
      if (parsed.error) return { ...state(), error: parsed.error };
      days = parsed.days;
      continue;
    }
    if (arg.startsWith("-")) {
      return { ...state(), error: `Unknown cache flag: ${arg}` };
    }
    if (arg === "info" || arg === "clean" || arg === "prune") {
      if (subcommand) {
        return { ...state(), error: `Unexpected cache argument: ${arg}` };
      }
      subcommand = arg;
      continue;
    }
    return { ...state(), error: `Unknown cache subcommand: ${arg}` };
  }

  if (!subcommand) {
    return {
      ...state(),
      error: "Usage: bapm cache <info|clean|prune> [--shared] [--days N] [--json] [-y] [--dry-run]",
    };
  }
  if (dryRun && subcommand !== "clean" && subcommand !== "prune") {
    return { ...state(), error: `Unsupported cache flag on ${subcommand}: --dry-run` };
  }
  if (json && subcommand !== "prune") {
    return { ...state(), error: `Unsupported cache flag on ${subcommand}: --json` };
  }
  if (days !== undefined && subcommand !== "prune") {
    return { ...state(), error: `Unsupported cache flag on ${subcommand}: --days` };
  }
  return state();
}

function parseDays(raw: string | undefined): { days?: number; error?: string } {
  if (raw === undefined || raw.startsWith("-") || !/^\d+$/.test(raw)) {
    return { error: `--days must be a nonnegative integer (got ${raw ?? "nothing"})` };
  }
  const days = Number(raw);
  if (!Number.isSafeInteger(days)) {
    return { error: `--days must be a nonnegative integer (got ${raw})` };
  }
  return { days };
}

export function formatCacheHelp(deps: LifecycleCliDeps): string {
  return `${deps.name} cache — Modules-cache (apm_modules) info/clean and shared-cache prune

Usage:
  bapm cache info [--shared]
  bapm cache clean [-y|--yes] [--dry-run] [--shared]
  bapm cache prune --shared [--days N] [--dry-run] [--json] [-y]

Options:
  -y, --yes    Skip confirmation where applicable (prune is non-interactive;
               the flag is accepted for symmetry with destructive commands)
  --dry-run    Preview clean/prune without deleting (no -y required)
  --shared     Operate on the opt-in shared git mirror cache instead of
               project modules (BAPM_CACHE_DIR; BAPM_NO_CACHE=1 disables use)
  --days N     Prune shared mirrors not modified/accessed in N days
               (default: 30; nonnegative integer)
  --json       Stable prune output: {"pruned":N,"failed":N,"candidates":[...],"root":"..."}
  --help, -h   Show this help

By default cache info/clean operate on the project modules-cache root (apm_modules).
cache prune never deletes apm_modules: without --shared it prints a pointer to
bapm prune. With --shared it only prunes bare mirrors under <BAPM_CACHE_DIR>/git.
Missing BAPM_CACHE_DIR is a successful no-op ("shared cache not configured").
After clean/prune, re-run install/lock to repopulate.
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
      const info = parsed.shared ? sharedGitCacheInfo() : cacheInfo({ cwd: options.cwd });
      console.log(info.text);
      return { ok: true, exitCode: 0 };
    }

    if (parsed.subcommand === "prune") {
      return runPrune(deps, parsed);
    }

    const result = parsed.shared
      ? sharedGitCacheClean({
          yes: parsed.yes,
          dryRun: parsed.dryRun,
        })
      : cacheClean({
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

function runPrune(deps: LifecycleCliDeps, parsed: ParsedCacheArgs): LifecycleResult {
  if (!parsed.shared) {
    const message =
      "project apm_modules is handled by `bapm prune`; pass --shared to prune " +
      "the shared git mirror cache under BAPM_CACHE_DIR";
    if (parsed.json) {
      console.log(serializePruneJson({ pruned: 0, failed: 0, candidates: [], root: null }));
      console.error(`${deps.name}: ${message}`);
    } else {
      console.log(message);
    }
    return { ok: true, exitCode: 0, message };
  }

  const result = pruneSharedCache({
    days: parsed.days,
    dryRun: parsed.dryRun,
    yes: parsed.yes,
  });

  if (parsed.json) {
    console.log(
      serializePruneJson({
        pruned: result.pruned,
        failed: result.failed,
        candidates: result.candidates,
        root: result.root ?? null,
      }),
    );
    if (result.reason === "env-unset" || result.failed > 0) {
      console.error(`${deps.name}: ${result.message}`);
    }
  } else {
    if (result.ok) console.log(result.message);
    else console.error(`${deps.name}: ${result.message}`);
  }

  return { ok: result.ok, exitCode: result.ok ? 0 : 1, message: result.message };
}

function serializePruneJson(value: {
  pruned: number;
  failed: number;
  candidates: string[];
  root: string | null;
}): string {
  return JSON.stringify({
    pruned: value.pruned,
    failed: value.failed,
    candidates: value.candidates,
    root: value.root,
  });
}
