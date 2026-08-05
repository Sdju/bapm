import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { LockDeps, LockOptions, LockResult } from "../types/lock.types.ts";

export function formatLockHelp(_deps?: LockDeps): string {
  return `bapm lock — Resolve dependencies and write lockfile

Usage:
  bapm lock [options]
  bapm lock export [options]

Options:
  --update                    Re-resolve mutable refs
  --verbose, -v               Verbose output
  --parallel-downloads <n>    Concurrent downloads (default 4; 0 = serial)
  --policy <path>             Use explicit policy file
  --no-policy                 Skip policy discovery and checks
  --help, -h                  Show this help

Export (read-only SBOM from existing lockfile; no resolve/deploy):
  bapm lock export [-f|--format cyclonedx|spdx] [-o|--output <file>] [--timestamp <iso>]
`;
}

export function parseLockArgs(argv: string[]): {
  updateRefs: boolean;
  verbose: boolean;
  parallelDownloads?: number;
  policyPath?: string;
  noPolicy: boolean;
  help?: boolean;
  error?: string;
} {
  let updateRefs = false;
  let verbose = false;
  let parallelDownloads: number | undefined;
  let policyPath: string | undefined;
  let noPolicy = false;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--update") {
      updateRefs = true;
      continue;
    }
    if (arg === "--verbose" || arg === "-v") {
      verbose = true;
      continue;
    }
    if (arg === "--no-policy") {
      noPolicy = true;
      continue;
    }
    if (arg === "--policy") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return {
          updateRefs,
          verbose,
          noPolicy,
          error: "Missing value for --policy <path>",
        };
      }
      policyPath = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--policy=")) {
      policyPath = arg.slice("--policy=".length);
      if (!policyPath) {
        return { updateRefs, verbose, noPolicy, error: "Missing value for --policy=<path>" };
      }
      continue;
    }
    if (arg === "--parallel-downloads") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        return {
          updateRefs,
          verbose,
          noPolicy,
          error: "missing value for --parallel-downloads",
        };
      }
      const n = Number(next);
      if (!Number.isFinite(n) || n < 0) {
        return {
          updateRefs,
          verbose,
          noPolicy,
          error: `invalid --parallel-downloads value: ${next}`,
        };
      }
      parallelDownloads = Math.floor(n);
      i++;
      continue;
    }
    if (arg.startsWith("--parallel-downloads=")) {
      const raw = arg.slice("--parallel-downloads=".length);
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        return {
          updateRefs,
          verbose,
          noPolicy,
          error: `invalid --parallel-downloads value: ${raw}`,
        };
      }
      parallelDownloads = Math.floor(n);
      continue;
    }
    // Unknown flags: ignore soft for now (APM subset); do not fail as "unknown command"
  }

  return { updateRefs, verbose, parallelDownloads, policyPath, noPolicy, help };
}

type ExportParsed = {
  help?: boolean;
  format: string;
  output?: string;
  timestamp?: string;
  error?: string;
};

function parseExportArgs(argv: string[]): ExportParsed {
  let format = "cyclonedx";
  let output: string | undefined;
  let timestamp: string | undefined;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--format" || arg === "-f") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        return { format, error: "missing value for --format / -f" };
      }
      format = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--format=")) {
      format = arg.slice("--format=".length);
      if (!format) return { format, error: "missing value for --format=" };
      continue;
    }
    if (arg === "--output" || arg === "-o") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        return { format, error: "missing value for --output / -o" };
      }
      output = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--output=")) {
      output = arg.slice("--output=".length);
      if (!output) return { format, error: "missing value for --output=" };
      continue;
    }
    if (arg === "--timestamp") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        return { format, error: "missing value for --timestamp" };
      }
      timestamp = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--timestamp=")) {
      timestamp = arg.slice("--timestamp=".length);
      if (!timestamp) return { format, error: "missing value for --timestamp=" };
      continue;
    }
    if (arg.startsWith("-")) {
      return { format, error: `Unknown lock export flag: ${arg}` };
    }
    return { format, error: `Unexpected lock export argument: ${arg}` };
  }

  return { help, format, output, timestamp };
}

async function runLockExport(deps: LockDeps, options: LockOptions): Promise<LockResult> {
  const args = options.args ?? [];
  const exportArgs = args[0] === "export" ? args.slice(1) : args;
  const parsed = parseExportArgs(exportArgs);
  if (parsed.help) {
    console.log(formatLockHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    console.error(parsed.error);
    return { ok: false, exitCode: 1, message: parsed.error };
  }
  if (!deps.exportSbom) {
    const message = "lock export is unavailable (exportSbom not wired)";
    console.error(message);
    return { ok: false, exitCode: 1, message };
  }

  const result = await deps.exportSbom({
    cwd: options.cwd,
    format: parsed.format,
    timestamp: parsed.timestamp,
  });

  if (!result.ok) {
    console.error(result.error);
    return { ok: false, exitCode: 1, message: result.error };
  }

  if (parsed.output) {
    mkdirSync(dirname(parsed.output), { recursive: true });
    writeFileSync(parsed.output, result.json, "utf8");
    console.error(`SBOM written to ${parsed.output} (format=${result.format})`);
    return { ok: true, exitCode: 0 };
  }

  // SBOM body only on stdout (no diagnostics).
  console.log(result.json.replace(/\n$/, ""));
  return { ok: true, exitCode: 0 };
}

export async function runLock(deps: LockDeps, options: LockOptions): Promise<LockResult> {
  const args = options.args ?? [];
  if (args[0] === "export") {
    return runLockExport(deps, options);
  }

  const parsed = parseLockArgs(args);
  if (parsed.help) {
    console.log(formatLockHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    return { ok: false, exitCode: 1, message: parsed.error };
  }

  try {
    const result = await deps.resolveAndLock({
      cwd: options.cwd,
      updateRefs: options.updateRefs ?? parsed.updateRefs,
      verbose: options.verbose ?? parsed.verbose,
      parallelDownloads: options.parallelDownloads ?? parsed.parallelDownloads,
      policyPath: parsed.policyPath,
      policy: parsed.policyPath,
      noPolicy: parsed.noPolicy,
    });
    const lockPath = result.lockPath;
    return {
      ok: true,
      exitCode: 0,
      lockPath,
      message: `Lockfile written to ${lockPath}`,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : String(error);
    return { ok: false, exitCode: 1, message };
  }
}
