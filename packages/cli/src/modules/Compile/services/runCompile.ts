import { compileAgentsMd } from "@bapm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type CompileOptions = { args?: string[]; cwd?: string };

export function parseCompileArgs(argv: string[]): {
  validate: boolean;
  help?: boolean;
  error?: string;
} {
  let validate = false;
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") return { validate, help: true };
    if (arg === "--validate") {
      validate = true;
      continue;
    }
    if (arg.startsWith("-")) return { validate, error: `Unknown compile flag: ${arg}` };
    return { validate, error: `Unexpected compile argument: ${arg}` };
  }
  return { validate };
}

export function formatCompileHelp(deps: LifecycleCliDeps): string {
  return `${deps.name} compile — Emit AGENTS.md from discovered primitives (cursor)

Usage:
  bapm compile [--validate]

Options:
  --validate   Discover/validate only; do not write AGENTS.md
  --help, -h   Show this help

Emits AGENTS.md only (no CLAUDE.md / GEMINI.md / copilot-instructions).
`;
}

export async function runCompileCli(
  deps: LifecycleCliDeps,
  options: CompileOptions,
): Promise<LifecycleResult> {
  const parsed = parseCompileArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatCompileHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, exitCode: 1, message: parsed.error };
  }
  try {
    const result = compileAgentsMd({
      cwd: options.cwd,
      validate: parsed.validate,
    });
    if (result.wrote) {
      console.log(`Wrote ${result.path ?? "AGENTS.md"} (${result.primitivesCount} primitives)`);
    } else if (parsed.validate) {
      console.log(`compile --validate ok (${result.primitivesCount} primitives; no write)`);
    }
    return { ok: result.ok, exitCode: result.ok ? 0 : 1 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
}
