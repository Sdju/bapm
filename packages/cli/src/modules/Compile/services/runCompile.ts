import {
  compileAgentsMd,
  watchCompile,
  type CompileAgentsMdResult,
  type CompileWatchFactory,
  type CompileWatchTarget,
} from "@b-apm/core";
import {
  createCliIntegrationRegistry,
  registerManifestIntegrationsFromCwd,
} from "@/modules/Integrations";
import { readConfiguredTarget } from "@/modules/Config";
import { enrichUnregisteredTargetMessage } from "@/common/enrichUnregisteredTargetMessage.ts";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

/** Test hooks for `--watch`; production runs leave them undefined. */
export type CompileWatchHooks = {
  watchFactory?: CompileWatchFactory;
  once?: boolean;
  debounceMs?: number;
  signal?: AbortSignal;
  resolveTargets?: (cwd: string) => CompileWatchTarget[];
};

export type CompileOptions = { args?: string[]; cwd?: string; watch?: CompileWatchHooks };

export type ParsedCompileArgs = {
  validate: boolean;
  dryRun: boolean;
  verbose: boolean;
  /** Recompile when relevant inputs change. */
  watch: boolean;
  outputFile?: string;
  /** Single forced host id (backward-compatible; `--target a,b` also fills this). */
  target?: string;
  /** Forced host ids; more than one selects multi-target emit. */
  targets?: string[];
  /** Select every registered compile-capable host. */
  all?: boolean;
  /** Opt-in per-directory applyTo placement. */
  distributed: boolean;
  /** Remove orphaned generated outputs for the selected hosts. */
  clean: boolean;
  help?: boolean;
  error?: string;
};

function parseTargetList(value: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const part of value.split(",")) {
    const id = part.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function parseStrategy(value: string): "single-file" | "distributed" | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === "single-file" || normalized === "single" || normalized === "default") {
    return "single-file";
  }
  if (normalized === "distributed") return "distributed";
  return undefined;
}

export function parseCompileArgs(argv: string[]): ParsedCompileArgs {
  let validate = false;
  let dryRun = false;
  let verbose = false;
  let watch = false;
  let all = false;
  let distributed = false;
  let clean = false;
  let outputFile: string | undefined;
  let targets: string[] | undefined;

  const snapshot = () => ({
    validate,
    dryRun,
    verbose,
    watch,
    all,
    distributed,
    clean,
    outputFile,
    target: targets?.[0],
    targets,
  });

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      return { ...snapshot(), help: true };
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
    if (arg === "--watch" || arg === "-w") {
      watch = true;
      continue;
    }
    if (arg === "--all") {
      all = true;
      continue;
    }
    if (arg === "--distributed") {
      distributed = true;
      continue;
    }
    if (arg === "--clean") {
      clean = true;
      continue;
    }
    if (arg === "--strategy") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("-")) {
        return { ...snapshot(), error: "missing value for --strategy <single-file|distributed>" };
      }
      const strategy = parseStrategy(value);
      if (!strategy) {
        return {
          ...snapshot(),
          error: `unknown compile strategy: ${value} (expected single-file or distributed)`,
        };
      }
      distributed = strategy === "distributed";
      i += 1;
      continue;
    }
    if (arg.startsWith("--strategy=")) {
      const strategy = parseStrategy(arg.slice("--strategy=".length));
      if (!strategy) {
        return {
          ...snapshot(),
          error: `unknown compile strategy: ${arg.slice("--strategy=".length)} (expected single-file or distributed)`,
        };
      }
      distributed = strategy === "distributed";
      continue;
    }
    if (arg === "--output" || arg === "-o") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        return { ...snapshot(), error: "missing value for --output / -o" };
      }
      outputFile = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--output=")) {
      const value = arg.slice("--output=".length);
      if (!value) {
        return { ...snapshot(), error: "missing value for --output=" };
      }
      outputFile = value;
      continue;
    }
    if (arg === "--target") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        return { ...snapshot(), error: "missing value for --target <id>" };
      }
      const parsed = parseTargetList(value);
      if (parsed.length === 0) {
        return { ...snapshot(), error: "missing value for --target <id>" };
      }
      targets = parsed;
      i += 1;
      continue;
    }
    if (arg.startsWith("--target=")) {
      const parsed = parseTargetList(arg.slice("--target=".length));
      if (parsed.length === 0) {
        return { ...snapshot(), error: "missing value for --target=<id>" };
      }
      targets = parsed;
      continue;
    }
    if (arg.startsWith("-")) {
      return { ...snapshot(), error: `Unknown compile flag: ${arg}` };
    }
    return { ...snapshot(), error: `Unexpected compile argument: ${arg}` };
  }

  return snapshot();
}

export function formatCompileHelp(deps: LifecycleCliDeps): string {
  return `${deps.name} compile — Emit the agent's instructions file (AGENTS.md, CLAUDE.md, …)

Usage:
  bapm compile [-o PATH] [--target <id>[,<id>…]] [--all] [--distributed] [--clean] [--dry-run] [-v] [--watch] [--validate]

Options:
  -o, --output PATH   Override the target's default output path (single target only)
  --target <ids>      Force one host, or a comma-separated list (cursor,claude)
  --all               Emit for every registered compile-capable host in one run
  --distributed       Place instruction applyTo globs in matching project directories
  --strategy <name>   single-file (default) or distributed
  --clean             Remove orphaned generated outputs for the selected hosts
  --dry-run           Preview every would-write path and --clean removal; do not mutate
  -v, --verbose       Print thin source attribution (name, type, path)
  --watch, -w         Compile once, then recompile when inputs change (Ctrl+C stops)
  --validate          Discover/validate only; do not write or clean
  --help, -h          Show this help

Host selection: --target / --all → local-overlay active → manifest active → config target → sole auto-detect → fail.
--clean uses the same selection; it does not require --target when a sole active/config/detect target applies.
When active lists multiple hosts, pass --target <id> or --target <id>,<id>, or --all.
Missing or ambiguous detection requires an explicit --target.

Build ID: every compiled Markdown output ends with one deterministic
<!-- Build ID: <12 hex> --> line hashed over the normalized body. Identical
inputs keep the same id; changed inputs change it.

--clean removes only orphaned target-shaped outputs that carry a valid Build ID
and are absent from this run's planned output set. Hand-authored files and
generated files edited after compile are never deleted. --validate suppresses
cleaning.

--watch performs the initial compile, then watches the manifest (bapm.yml /
apm.yml), .apm/, apm_modules/, package-root skills/hooks/prompts and local
dependency directories. Changes are debounced (~200 ms), recompiled serially,
and transient compile errors are printed without stopping the loop. Ctrl+C or
SIGTERM stops cleanly with exit 0. --watch is incompatible with --validate;
--watch --dry-run only previews each run. It never downloads; run bapm install
separately when dependencies change.

Multi-target: each selected host writes its own file in one invocation. If two selected
hosts share an output path (Cursor, Codex, OpenCode, Kiro, Grok Build, Hermes, Antigravity
all use AGENTS.md), compile fails closed and lists the colliding hosts — it never overwrites.
-o is not accepted with multi-target selection; run one host per output path.

Distributed mode (opt-in) reads instruction applyTo (scalar, comma list, or YAML list),
uses the literal directory prefix of each glob (src/** → src/AGENTS.md, docs/*.md → docs/),
keeps global/unmatched instructions in the root output, and preserves each host's default
basename (CLAUDE.md, GEMINI.md, .github/copilot-instructions.md). Root-only globs such as
**/*.ts stay in the root file. Outputs never leave the project; symlinked or escaping paths
fail closed. -o is rejected in distributed mode because each directory gets its own file.

Run from the directory that contains ${deps.manifestFile}.
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
  if (parsed.all && parsed.targets?.length) {
    const message = "use either --target or --all, not both";
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
  const explicitMulti = (parsed.targets?.length ?? 0) > 1;
  if (parsed.distributed && parsed.outputFile) {
    const message =
      "--distributed cannot share one --output / -o path; per-directory outputs derive from the target default";
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
  if (explicitMulti && parsed.outputFile) {
    const message =
      "multiple compile targets cannot share one --output path; select a single target or omit -o";
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
  if (parsed.watch && parsed.validate) {
    const message = "--watch cannot be combined with --validate (watch must write each run)";
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
  const multi = parsed.all === true || explicitMulti;
  const cwd = options.cwd ?? process.cwd();

  if (parsed.watch) {
    return runCompileWatch(deps, options, parsed, cwd, multi);
  }

  try {
    await runCompileOnce(deps, parsed, cwd, multi);
    return { ok: true, exitCode: 0 };
  } catch (error) {
    const message = compileErrorMessage(error, cwd);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
}

/** One compile invocation: fresh registry, target selection, output printing. */
async function runCompileOnce(
  deps: LifecycleCliDeps,
  parsed: ParsedCompileArgs,
  cwd: string,
  multi: boolean,
): Promise<CompileAgentsMdResult> {
  // Fresh registry per run so object-map loads do not leak across projects.
  const registry = createCliIntegrationRegistry();
  await registerManifestIntegrationsFromCwd(registry, cwd);
  const result = await compileAgentsMd({
    cwd,
    outputFile: parsed.outputFile,
    forcedTarget: multi ? undefined : parsed.target,
    forcedTargets: multi && !parsed.all ? parsed.targets : undefined,
    all: parsed.all === true,
    distributed: parsed.distributed,
    clean: parsed.clean,
    configTarget: readConfiguredTarget(),
    integrationRegistry: registry,
    validate: parsed.validate,
    dryRun: parsed.dryRun,
    verbose: parsed.verbose,
  });

  printCompileResult(parsed, result);
  return result;
}

function printCompileResult(parsed: ParsedCompileArgs, result: CompileAgentsMdResult): void {
  if (parsed.verbose) {
    for (const entry of result.attribution) {
      const parts = [entry.name, entry.type];
      if (entry.path) parts.push(entry.path);
      console.log(parts.join("\t"));
    }
  }

  const multiple = result.outputs.length > 1;
  // validate-first: when validate is set, never use dry-run would-write messaging
  if (parsed.validate) {
    console.log(
      `compile --validate ok (${result.primitivesCount} primitives; ${result.outputs.length} outputs; no write)`,
    );
  } else if (parsed.dryRun) {
    if (multiple) {
      for (const output of result.outputs) {
        console.log(
          `compile --dry-run: would write ${output.path} (${output.targetId}) (${result.primitivesCount} primitives)`,
        );
      }
    } else {
      const previewPath = result.path ?? parsed.outputFile ?? "(target default)";
      console.log(
        `compile --dry-run: would write ${previewPath} (${result.primitivesCount} primitives)`,
      );
    }
  } else if (multiple) {
    for (const output of result.outputs) {
      if (output.wrote) {
        console.log(
          `Wrote ${output.path} (${output.targetId}) (${result.primitivesCount} primitives)`,
        );
      }
    }
  } else if (result.wrote) {
    console.log(`Wrote ${result.path ?? "AGENTS.md"} (${result.primitivesCount} primitives)`);
  }

  if (parsed.clean && !parsed.validate) {
    const clean = result.clean;
    if (parsed.dryRun) {
      const paths = clean?.wouldRemove ?? [];
      if (paths.length === 0) {
        console.log("compile --clean --dry-run: no orphaned generated outputs to remove");
      } else {
        for (const path of paths) {
          console.log(`compile --clean --dry-run: would remove ${path}`);
        }
      }
    } else {
      const paths = clean?.removed ?? [];
      if (paths.length === 0) {
        console.log("compile --clean: no orphaned generated outputs to remove");
      } else {
        for (const path of paths) {
          console.log(`compile --clean: removed ${path}`);
        }
      }
    }
    if (parsed.verbose) {
      for (const entry of clean?.skipped ?? []) {
        console.log(`compile --clean: kept ${entry.path} (${entry.reason})`);
      }
    }
  }
}

async function runCompileWatch(
  deps: LifecycleCliDeps,
  options: CompileOptions,
  parsed: ParsedCompileArgs,
  cwd: string,
  multi: boolean,
): Promise<LifecycleResult> {
  const controller = new AbortController();
  const external = options.watch?.signal;
  const forwardAbort = (): void => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener("abort", forwardAbort, { once: true });
  }

  const onSignal = (): void => {
    console.log(`${deps.name} compile --watch: stopping…`);
    controller.abort();
  };
  // Replacing the default SIGINT/SIGTERM action lets the loop close watchers
  // and return exit 0 instead of killing the process mid-write.
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);

  try {
    const result = await watchCompile({
      cwd,
      compile: async () => runCompileOnce(deps, parsed, cwd, multi),
      watchFactory: options.watch?.watchFactory,
      once: options.watch?.once,
      debounceMs: options.watch?.debounceMs,
      signal: controller.signal,
      resolveTargets: options.watch?.resolveTargets,
      onStatus: (message) => console.log(message),
      onError: (error) => console.error(`${deps.name}: ${compileErrorMessage(error, cwd)}`),
    });

    if (result.stopped === "once") {
      const ok = result.errors === 0;
      return { ok, exitCode: ok ? 0 : 1 };
    }
    return { ok: true, exitCode: 0 };
  } catch (error) {
    const message = compileErrorMessage(error, cwd);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  } finally {
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
    external?.removeEventListener("abort", forwardAbort);
  }
}

function compileErrorMessage(error: unknown, cwd: string): string {
  return enrichUnregisteredTargetMessage(
    error instanceof Error ? error.message : String(error),
    cwd,
  );
}
