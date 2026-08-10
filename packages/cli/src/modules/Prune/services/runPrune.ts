import { runPrune as coreRunPrune } from "@b-apm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type PruneOptions = { args?: string[]; cwd?: string };

export function parsePruneArgs(argv: string[]): {
  dryRun: boolean;
  help?: boolean;
  error?: string;
} {
  let dryRun = false;
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") return { dryRun, help: true };
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg.startsWith("-")) return { dryRun, error: `Unknown prune flag: ${arg}` };
  }
  return { dryRun };
}

export function formatPruneHelp(deps: LifecycleCliDeps): string {
  return `${deps.name} prune — Remove orphan modules not in the lock graph

Usage:
  bapm prune [--dry-run]
`;
}

export async function runPruneCli(
  deps: LifecycleCliDeps,
  options: PruneOptions,
): Promise<LifecycleResult> {
  const parsed = parsePruneArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatPruneHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, exitCode: 1, message: parsed.error };
  }
  try {
    const result = await coreRunPrune({ cwd: options.cwd, dryRun: parsed.dryRun });
    if (result.text) console.log(result.text);
    return { ok: result.ok, exitCode: result.exitCode };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
}
