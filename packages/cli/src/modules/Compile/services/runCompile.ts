import { compileAgentsMd } from "@b-apm/core";
import {
  createCliIntegrationRegistry,
  registerManifestIntegrationsFromCwd,
} from "@/modules/Integrations";
import { readConfiguredTarget } from "@/modules/Config";
import { enrichUnregisteredTargetMessage } from "@/common/enrichUnregisteredTargetMessage.ts";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type CompileOptions = { args?: string[]; cwd?: string };

export type ParsedCompileArgs = {
  validate: boolean;
  dryRun: boolean;
  verbose: boolean;
  outputFile?: string;
  /** Single forced host id (backward-compatible; `--target a,b` also fills this). */
  target?: string;
  /** Forced host ids; more than one selects multi-target emit. */
  targets?: string[];
  /** Select every registered compile-capable host. */
  all?: boolean;
  /** Opt-in per-directory applyTo placement. */
  distributed: boolean;
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
  let all = false;
  let distributed = false;
  let outputFile: string | undefined;
  let targets: string[] | undefined;

  const snapshot = () => ({
    validate,
    dryRun,
    verbose,
    all,
    distributed,
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
    if (arg === "--all") {
      all = true;
      continue;
    }
    if (arg === "--distributed") {
      distributed = true;
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
  bapm compile [-o PATH] [--target <id>[,<id>…]] [--all] [--distributed] [--dry-run] [-v] [--validate]

Options:
  -o, --output PATH   Override the target's default output path (single target only)
  --target <ids>      Force one host, or a comma-separated list (cursor,claude)
  --all               Emit for every registered compile-capable host in one run
  --distributed       Place instruction applyTo globs in matching project directories
  --strategy <name>   single-file (default) or distributed
  --dry-run           Preview every would-write path; do not write
  -v, --verbose       Print thin source attribution (name, type, path)
  --validate          Discover/validate only; do not write
  --help, -h          Show this help

Host selection: --target / --all → local-overlay active → manifest active → config target → sole auto-detect → fail.
When active lists multiple hosts, pass --target <id> or --target <id>,<id>, or --all.
Missing or ambiguous detection requires an explicit --target.

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
  const multi = parsed.all === true || explicitMulti;
  try {
    const cwd = options.cwd ?? process.cwd();
    // Fresh registry per run so object-map loads do not leak across projects.
    const registry = createCliIntegrationRegistry();
    await registerManifestIntegrationsFromCwd(registry, cwd);
    const result = await compileAgentsMd({
      cwd: options.cwd,
      outputFile: parsed.outputFile,
      forcedTarget: multi ? undefined : parsed.target,
      forcedTargets: multi && !parsed.all ? parsed.targets : undefined,
      all: parsed.all === true,
      distributed: parsed.distributed,
      configTarget: readConfiguredTarget(),
      integrationRegistry: registry,
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

    return { ok: result.ok, exitCode: result.ok ? 0 : 1 };
  } catch (error) {
    const message = enrichUnregisteredTargetMessage(
      error instanceof Error ? error.message : String(error),
      options.cwd ?? process.cwd(),
    );
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
}
