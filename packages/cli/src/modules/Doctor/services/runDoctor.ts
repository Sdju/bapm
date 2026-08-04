import { runDoctor as coreRunDoctor } from "@bapm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type DoctorOptions = { args?: string[]; cwd?: string };

export function parseDoctorArgs(argv: string[]): { help?: boolean; error?: string } {
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg.startsWith("-")) return { error: `Unknown doctor flag: ${arg}` };
  }
  return {};
}

export function formatDoctorHelp(deps: LifecycleCliDeps): string {
  return `${deps.name} doctor — Environment and project sanity checks

Usage:
  bapm doctor
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
    const result = await coreRunDoctor({ cwd: options.cwd });
    if (result.text) console.log(result.text);
    return { ok: result.ok, exitCode: result.exitCode };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
}
