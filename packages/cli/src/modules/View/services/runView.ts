import { viewPackage } from "@b-apm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type ViewCliDeps = LifecycleCliDeps;

export type ViewOptions = { args?: string[]; cwd?: string };

export function formatViewHelp(deps: ViewCliDeps): string {
  return `${deps.name} view — Inspect a locally installed package (offline)

Usage:
  bapm view <package> [options]

Arguments:
  <package>         Package query (lock name, repo_url, owner/repo, or unique basename)

Options:
  --help, -h        Show this help

Exit codes:
  0  Unique installed package inspected
  1  Missing package arg, not installed, or ambiguous query
  2  Missing or unreadable ${deps.lockFile}

Notes:
  Local / offline only — uses lock + apm_modules. No network, registry, or versions listing.
  Remote \`view <package> versions\` / --registry / -g are not supported in this release.
`;
}

export type ParsedViewArgs = {
  help?: boolean;
  package?: string;
  error?: string;
};

export function parseViewArgs(argv: string[]): ParsedViewArgs {
  let help = false;
  let pkg: string | undefined;

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--registry" || arg.startsWith("--registry=")) {
      return {
        package: pkg,
        error: "Unsupported flag: --registry (remote versions are out of scope)",
      };
    }
    if (arg === "-g" || arg === "--global") {
      return {
        package: pkg,
        error: `Unsupported flag: ${arg} (global scope is out of scope)`,
      };
    }
    if (arg.startsWith("-") && arg !== "-") {
      return {
        package: pkg,
        error: `Unknown flag: ${arg}`,
      };
    }
    if (pkg === undefined) {
      pkg = arg;
      continue;
    }
    return {
      package: pkg,
      error: `Unexpected argument: ${arg}`,
    };
  }

  if (help) {
    return { help: true, package: pkg };
  }

  if (!pkg) {
    return {
      error: "Usage: bapm view <package> (package argument required)",
    };
  }

  return { package: pkg };
}

export async function runViewCli(
  deps: ViewCliDeps,
  options: ViewOptions = {},
): Promise<LifecycleResult> {
  const parsed = parseViewArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatViewHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, exitCode: 1, message: parsed.error };
  }

  const result = viewPackage({
    cwd: options.cwd,
    package: parsed.package,
    name: parsed.package,
    query: parsed.package,
  });

  if (result.exitCode === 0) {
    if (result.text) console.log(result.text);
    return { ok: true, exitCode: 0 };
  }

  const err = result.text || `view failed (exit ${result.exitCode})`;
  console.error(err);
  return { ok: false, exitCode: result.exitCode, message: err };
}
