import { runOutdated as coreRunOutdated } from "@bapm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type OutdatedOptions = { args?: string[]; cwd?: string };

export type ParsedOutdatedArgs = {
  help?: boolean;
  verbose?: boolean;
  error?: string;
};

export function parseOutdatedArgs(argv: string[]): ParsedOutdatedArgs {
  let verbose = false;
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") return { help: true, verbose };
    if (arg === "--verbose" || arg === "-v") {
      verbose = true;
      continue;
    }
    if (arg.startsWith("-")) return { error: `Unknown outdated flag: ${arg}`, verbose };
  }
  return { verbose };
}

export function formatOutdatedHelp(deps: LifecycleCliDeps): string {
  return `${deps.name} outdated — Report lock pins vs remote tips

Usage:
  bapm outdated [options]

Options:
  -v, --verbose            Richer detail (chosen tip ref, skip reasons, candidates)
  -h, --help               Show this help

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
    });
    if (result.text) console.log(result.text);
    return { ok: result.ok, exitCode: result.exitCode };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
}
