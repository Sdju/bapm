import type { LockDeps, LockOptions, LockResult } from "../types/lock.types.ts";

export function formatLockHelp(_deps?: LockDeps): string {
  return `bapm lock — Resolve dependencies and write lockfile

Usage:
  bapm lock [options]

Options:
  --update                    Re-resolve mutable refs
  --verbose, -v               Verbose output
  --parallel-downloads <n>    Concurrent downloads
  --policy <path>             Use explicit policy file
  --no-policy                 Skip policy discovery and checks
  --help, -h                  Show this help
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
      if (!Number.isFinite(n) || n < 1) {
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
      if (!Number.isFinite(n) || n < 1) {
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

export async function runLock(deps: LockDeps, options: LockOptions): Promise<LockResult> {
  const parsed = parseLockArgs(options.args ?? []);
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
