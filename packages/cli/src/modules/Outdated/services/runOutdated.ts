import { runOutdated as coreRunOutdated } from "@b-apm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type OutdatedOptions = { args?: string[]; cwd?: string };

/** CLI default when `-j` / `--parallel-checks` omitted (APM-aligned). */
const DEFAULT_PARALLEL_CHECKS = 4;

export type ParsedOutdatedArgs = {
  help?: boolean;
  verbose?: boolean;
  json?: boolean;
  parallelChecks?: number;
  error?: string;
};

export function parseOutdatedArgs(argv: string[]): ParsedOutdatedArgs {
  let verbose = false;
  let json = false;
  let help = false;
  let parallelChecks: number | undefined;

  const partial = (): ParsedOutdatedArgs => ({
    help,
    verbose,
    json,
    parallelChecks,
  });

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--verbose" || arg === "-v") {
      verbose = true;
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "-j" || arg === "--parallel-checks") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        return { ...partial(), error: `Missing value for ${arg} <n>` };
      }
      const n = Number(next);
      if (!Number.isFinite(n) || n < 0) {
        return {
          ...partial(),
          error: `Invalid ${arg === "-j" ? "-j" : "--parallel-checks"} value: ${next}`,
        };
      }
      parallelChecks = Math.floor(n);
      i += 1;
      continue;
    }
    if (arg.startsWith("-j=")) {
      const raw = arg.slice("-j=".length);
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        return { ...partial(), error: `Invalid -j value: ${raw}` };
      }
      parallelChecks = Math.floor(n);
      continue;
    }
    if (arg.startsWith("--parallel-checks=")) {
      const raw = arg.slice("--parallel-checks=".length);
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        return { ...partial(), error: `Invalid --parallel-checks value: ${raw}` };
      }
      parallelChecks = Math.floor(n);
      continue;
    }
    if (arg.startsWith("-")) {
      return { ...partial(), error: `Unknown outdated flag: ${arg}` };
    }
    return { ...partial(), error: `Unexpected outdated argument: ${arg}` };
  }

  return {
    help,
    verbose,
    json,
    parallelChecks: parallelChecks ?? DEFAULT_PARALLEL_CHECKS,
  };
}

export function formatOutdatedHelp(deps: LifecycleCliDeps): string {
  return `${deps.name} outdated — Report lock pins vs remote tips

Usage:
  bapm outdated [options]

Options:
  -v, --verbose            Richer detail (chosen tip ref, skip reasons, candidates)
  -j, --parallel-checks <n>
                           Concurrent remote checks (default 4; 0 = serial)
  --json                   Machine-readable OutdatedRow list as JSON
                           ({ "dependencies": [...] }); suppresses human table
  -h, --help               Show this help

Pin checks: branch/tag/abbreviated SHA use tip-of-ref; semver constraints use
highest satisfying tag; full 40-hex SHA pins compare against the latest
annotated semver tag (outdated reporting only — does not rewrite the manifest).

Report-only: does not modify the lockfile, modules cache, or project files.
Use \`bapm update\` to re-resolve and write refreshed pins.

Exit 0 even when outdated rows exist. Missing lock → non-zero.
`;
}

export async function runOutdatedCli(
  deps: LifecycleCliDeps,
  options: OutdatedOptions,
): Promise<LifecycleResult> {
  const parsed = parseOutdatedArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatOutdatedHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, exitCode: 1, message: parsed.error };
  }
  try {
    const result = await coreRunOutdated({
      cwd: options.cwd,
      verbose: parsed.verbose === true,
      parallelChecks: parsed.parallelChecks ?? DEFAULT_PARALLEL_CHECKS,
    });
    if (parsed.json) {
      console.log(JSON.stringify({ dependencies: result.rows }, null, 2));
    } else if (result.text) {
      console.log(result.text);
    }
    return { ok: result.ok, exitCode: result.exitCode };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
}
