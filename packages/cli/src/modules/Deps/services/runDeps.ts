import { listDeps, treeDeps, whyDeps } from "@bapm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type DepsOptions = { args?: string[]; cwd?: string };

export function parseDepsArgs(argv: string[]): {
  sub?: string;
  packageName?: string;
  help?: boolean;
  error?: string;
} {
  if (argv.length === 0) return { sub: "list" };
  const [sub, ...rest] = argv;
  if (sub === "--help" || sub === "-h") return { help: true };
  if (sub?.startsWith("-")) return { error: `Unknown deps flag: ${sub}` };
  if (!["list", "tree", "why"].includes(sub ?? "")) {
    return { error: `Unknown deps subcommand: ${sub}` };
  }
  for (const arg of rest) {
    if (arg === "--help" || arg === "-h") return { sub, help: true };
    if (arg.startsWith("-")) return { sub, error: `Unknown deps flag: ${arg}` };
  }
  return {
    sub,
    packageName: rest.find((a) => !a.startsWith("-")),
  };
}

export function formatDepsHelp(deps: LifecycleCliDeps): string {
  return `${deps.name} deps — Inspect lock dependencies

Usage:
  bapm deps list
  bapm deps tree
  bapm deps why <package>
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
      console.log(result.text);
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
