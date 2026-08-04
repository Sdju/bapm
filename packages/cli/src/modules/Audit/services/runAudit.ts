import { runAuditCi as coreRunAuditCi } from "@bapm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type AuditOptions = { args?: string[]; cwd?: string };

export function parseAuditArgs(argv: string[]): {
  ci: boolean;
  help?: boolean;
  error?: string;
} {
  let ci = false;
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") return { ci, help: true };
    if (arg === "--ci") {
      ci = true;
      continue;
    }
    if (arg.startsWith("-")) return { ci, error: `Unknown audit flag: ${arg}` };
  }
  return { ci };
}

export function formatAuditHelp(deps: LifecycleCliDeps): string {
  return `${deps.name} audit — Integrity checks

Usage:
  bapm audit --ci

Options:
  --ci    CI gate: lock present + deployed presence + hash re-verify
`;
}

export async function runAuditCli(
  deps: LifecycleCliDeps,
  options: AuditOptions,
): Promise<LifecycleResult> {
  const parsed = parseAuditArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatAuditHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, exitCode: 1, message: parsed.error };
  }
  try {
    const result = await coreRunAuditCi({ cwd: options.cwd, ci: parsed.ci || true });
    if (result.text) console.log(result.text);
    return { ok: result.ok, exitCode: result.exitCode };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
}
