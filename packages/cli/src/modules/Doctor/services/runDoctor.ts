import { runDoctor as coreRunDoctor } from "@b-apm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type DoctorOptions = { args?: string[]; cwd?: string };

export function parseDoctorArgs(argv: string[]): {
  help?: boolean;
  verbose?: boolean;
  error?: string;
} {
  let verbose = false;
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--verbose" || arg === "-v") {
      verbose = true;
      continue;
    }
    if (arg.startsWith("-")) return { error: `Unknown doctor flag: ${arg}` };
  }
  return verbose ? { verbose: true } : {};
}

export function formatDoctorHelp(deps: LifecycleCliDeps): string {
  return `${deps.name} doctor — Environment and project sanity checks

Usage:
  bapm doctor [options]

Options:
  -v, --verbose            Richer domain detail; thin network probe (informational)
  -h, --help               Show this help

Informational:
  auth                     Whether GITHUB_TOKEN / GH_TOKEN is set (names only, never secrets)
  network                  With -v: git ls-remote probe (never critical)
`;
}

export async function runDoctorCli(
  deps: LifecycleCliDeps,
  options: DoctorOptions,
): Promise<LifecycleResult> {
  const parsed = parseDoctorArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatDoctorHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, exitCode: 1, message: parsed.error };
  }
  try {
    const result = await coreRunDoctor({
      cwd: options.cwd,
      verbose: parsed.verbose,
    });
    if (result.text) console.log(result.text);
    return { ok: result.ok, exitCode: result.exitCode };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
}
