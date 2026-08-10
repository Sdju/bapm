import { findPath } from "@b-apm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type FindCliDeps = LifecycleCliDeps;

export type FindOptions = { args?: string[]; cwd?: string };

export function formatFindHelp(deps: FindCliDeps): string {
  return `${deps.name} find — Trace a deployed path back to locked package(s)

Usage:
  bapm find PATH [options]

Arguments:
  PATH              Relative workspace path deployed by an installed package

Options:
  --source          Append resolved origin (oci/git/local) to each owner
  --path            Print root-to-target dependency why-chains (like deps why)
  --help, -h        Show this help

Exit codes:
  0  Path is tracked in ${deps.lockFile}
  1  Readable lock, but path is not tracked
  2  Missing or unreadable ${deps.lockFile} (run: bapm install)

Notes:
  Offline only — uses lock inventory (deployed_file_hashes / lists). No network.
`;
}

export type ParsedFindArgs = {
  help?: boolean;
  path?: string;
  source: boolean;
  showPath: boolean;
  error?: string;
};

export function parseFindArgs(argv: string[]): ParsedFindArgs {
  let help = false;
  let path: string | undefined;
  let source = false;
  let showPath = false;

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--source") {
      source = true;
      continue;
    }
    if (arg === "--path") {
      showPath = true;
      continue;
    }
    if (arg.startsWith("-") && arg !== "-") {
      return {
        source,
        showPath,
        path,
        error: `Unknown flag: ${arg}`,
      };
    }
    if (path === undefined) {
      path = arg;
      continue;
    }
    return {
      source,
      showPath,
      path,
      error: `Unexpected argument: ${arg}`,
    };
  }

  if (help) {
    return { help: true, source, showPath, path };
  }

  if (!path) {
    return {
      source,
      showPath,
      error: "Usage: bapm find PATH (path argument required)",
    };
  }

  return { path, source, showPath };
}

export async function runFindCli(
  deps: FindCliDeps,
  options: FindOptions = {},
): Promise<LifecycleResult> {
  const parsed = parseFindArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatFindHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, exitCode: 1, message: parsed.error };
  }

  const result = findPath({
    cwd: options.cwd,
    path: parsed.path,
    query: parsed.path,
    source: parsed.source,
    showSource: parsed.source,
    why: parsed.showPath,
    showPath: parsed.showPath,
    pathDetail: parsed.showPath,
  });

  if (result.exitCode === 0) {
    if (result.text) console.log(result.text);
    return { ok: true, exitCode: 0 };
  }

  const err = result.stderr || result.text || `find failed (exit ${result.exitCode})`;
  console.error(err);
  return { ok: false, exitCode: result.exitCode, message: err };
}
