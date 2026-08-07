import { compileAgentsMd } from "@bapm/core";
import type { TargetRegistry } from "bapm-target-api";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type CompileOptions = { args?: string[]; cwd?: string; targetRegistry?: TargetRegistry };

export type ParsedCompileArgs = {
  validate: boolean;
  dryRun: boolean;
  verbose: boolean;
  outputFile?: string;
  target?: string;
  help?: boolean;
  error?: string;
};

export function parseCompileArgs(argv: string[]): ParsedCompileArgs {
  let validate = false;
  let dryRun = false;
  let verbose = false;
  let outputFile: string | undefined;
  let target: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      return { validate, dryRun, verbose, outputFile, target, help: true };
    }
    if (arg === "--validate") {
      validate = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--verbose" || arg === "-v") {
      verbose = true;
      continue;
    }
    if (arg === "--output" || arg === "-o") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        return {
          validate,
          dryRun,
          verbose,
          outputFile,
          error: "missing value for --output / -o",
        };
      }
      outputFile = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--output=")) {
      const value = arg.slice("--output=".length);
      if (!value) {
        return {
          validate,
          dryRun,
          verbose,
          outputFile,
          error: "missing value for --output=",
        };
      }
      outputFile = value;
      continue;
    }
    if (arg === "--target") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        return {
          validate,
          dryRun,
          verbose,
          outputFile,
          target,
          error: "missing value for --target <id>",
        };
      }
      target = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--target=")) {
      target = arg.slice("--target=".length);
      if (!target) {
        return {
          validate,
          dryRun,
          verbose,
          outputFile,
          target,
          error: "missing value for --target=<id>",
        };
      }
      continue;
    }
    if (arg.startsWith("-")) {
      return {
        validate,
        dryRun,
        verbose,
        outputFile,
        target,
        error: `Unknown compile flag: ${arg}`,
      };
    }
    return {
      validate,
      dryRun,
      verbose,
      outputFile,
      target,
      error: `Unexpected compile argument: ${arg}`,
    };
  }

  return { validate, dryRun, verbose, outputFile, target };
}

export function formatCompileHelp(deps: LifecycleCliDeps): string {
  return `${deps.name} compile — Emit target-owned output from discovered primitives

Usage:
  bapm compile [-o PATH] [--target <id>] [--dry-run] [-v] [--validate]

Options:
  -o, --output PATH   Override the target's default output path
  --target <id>       Required when target detection is missing or ambiguous
  --dry-run           Preview would-write path; do not write
  -v, --verbose       Print thin source attribution (name, type, path)
  --validate          Discover/validate only; do not write
  --help, -h          Show this help

The selected target determines the default output path and rendering.
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
    const result = await compileAgentsMd({
      cwd: options.cwd,
      outputFile: parsed.outputFile,
      forcedTarget: parsed.target,
      targetRegistry: options.targetRegistry,
      validate: parsed.validate,
      dryRun: parsed.dryRun,
      verbose: parsed.verbose,
    });

    if (parsed.verbose) {
      for (const entry of result.attribution) {
        const parts = [entry.name, entry.type];
        if (entry.path) parts.push(entry.path);
        console.log(parts.join("\t"));
      }
    }

    // validate-first: when validate is set, never use dry-run would-write messaging
    if (parsed.validate) {
      console.log(`compile --validate ok (${result.primitivesCount} primitives; no write)`);
    } else if (parsed.dryRun) {
      const previewPath = result.path ?? parsed.outputFile ?? "(target default)";
      console.log(
        `compile --dry-run: would write ${previewPath} (${result.primitivesCount} primitives)`,
      );
    } else if (result.wrote) {
      console.log(`Wrote ${result.path ?? "AGENTS.md"} (${result.primitivesCount} primitives)`);
    }

    return { ok: result.ok, exitCode: result.ok ? 0 : 1 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
}
