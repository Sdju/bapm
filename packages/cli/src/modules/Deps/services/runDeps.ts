import { cacheClean, listDeps, treeDeps, whyDeps } from "@bapm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type DepsOptions = { args?: string[]; cwd?: string };

const DEPS_SUBS = new Set(["list", "tree", "why", "clean"]);

export function parseDepsArgs(argv: string[]): {
  sub?: string;
  packageName?: string;
  help?: boolean;
  json?: boolean;
  yes?: boolean;
  error?: string;
} {
  if (argv.length === 0) return { sub: "list" };
  const [sub, ...rest] = argv;
  if (sub === "--help" || sub === "-h") return { help: true };
  if (sub?.startsWith("-")) return { error: `Unknown deps flag: ${sub}` };
  if (!DEPS_SUBS.has(sub ?? "")) {
    return { error: `Unknown deps subcommand: ${sub}` };
  }

  let json = false;
  let yes = false;
  const positionals: string[] = [];

  for (const arg of rest) {
    if (arg === "--help" || arg === "-h") return { sub, help: true };
    if (arg === "--json") {
      if (sub !== "why") {
        return { sub, error: `Unsupported deps flag on ${sub}: --json` };
      }
      json = true;
      continue;
    }
    if (arg === "-y" || arg === "--yes") {
      if (sub !== "clean") {
        return { sub, error: `Unknown deps flag: ${arg}` };
      }
      yes = true;
      continue;
    }
    if (arg.startsWith("-")) return { sub, error: `Unknown deps flag: ${arg}` };
    positionals.push(arg);
  }

  return {
    sub,
    packageName: positionals[0],
    json,
    yes,
  };
}

export function formatDepsHelp(deps: LifecycleCliDeps): string {
  return `${deps.name} deps — Inspect lock dependencies

Usage:
  bapm deps list
  bapm deps tree
  bapm deps why <package> [--json]
  bapm deps clean [-y|--yes]

Options:
  --json       Machine-readable why output (success on stdout, errors on stderr)
  -y, --yes    Confirm deps clean (modules wipe)
  --help, -h   Show this help

deps clean performs the same project modules wipe as \`cache clean\`
(apm_modules). It is not a shared APM git/http cache clean.
`;
}

export async function runDepsCli(
  deps: LifecycleCliDeps,
  options: DepsOptions,
): Promise<LifecycleResult> {
  const parsed = parseDepsArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatDepsHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, exitCode: 1, message: parsed.error };
  }
  try {
    if (parsed.sub === "clean") {
      const result = cacheClean({ cwd: options.cwd, yes: parsed.yes === true });
      if (result.refused) {
        const message = result.message.replace(/^cache clean/, "deps clean");
        console.error(`${deps.name}: ${message}`);
        return { ok: false, exitCode: 1, message };
      }
      const message = result.message.replace(/^cache clean/, "deps clean");
      console.log(message);
      return { ok: result.ok, exitCode: result.ok ? 0 : 1 };
    }
    if (parsed.sub === "tree") {
      const result = treeDeps({ cwd: options.cwd });
      console.log(result.text);
      return { ok: result.ok, exitCode: result.exitCode };
    }
    if (parsed.sub === "why") {
      const result = whyDeps({
        cwd: options.cwd,
        package: parsed.packageName,
        name: parsed.packageName,
      });
      if (parsed.json) {
        if (result.ok) {
          console.log(
            JSON.stringify(
              {
                package: result.package,
                paths: result.paths,
              },
              null,
              2,
            ),
          );
        } else {
          const err: Record<string, unknown> = { error: result.error };
          if (result.query != null) err.query = result.query;
          if (result.matches != null) err.matches = result.matches;
          console.error(JSON.stringify(err));
        }
        return { ok: result.ok, exitCode: result.exitCode };
      }
      if (result.ok) {
        console.log(result.text);
      } else {
        console.error(result.text);
      }
      return { ok: result.ok, exitCode: result.exitCode };
    }
    const result = listDeps({ cwd: options.cwd });
    console.log(result.text);
    return { ok: result.ok, exitCode: result.exitCode };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
}
