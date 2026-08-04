import type { LockDeps, LockOptions, LockResult } from "../types/lock.types.ts";

export function parseLockArgs(argv: string[]): {
  updateRefs: boolean;
  verbose: boolean;
  parallelDownloads?: number;
  error?: string;
} {
  let updateRefs = false;
  let verbose = false;
  let parallelDownloads: number | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--update") {
      updateRefs = true;
      continue;
    }
    if (arg === "--verbose" || arg === "-v") {
      verbose = true;
      continue;
    }
    if (arg === "--parallel-downloads") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        return {
          updateRefs,
          verbose,
          error: "missing value for --parallel-downloads",
        };
      }
      const n = Number(next);
      if (!Number.isFinite(n) || n < 1) {
        return {
          updateRefs,
          verbose,
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
          error: `invalid --parallel-downloads value: ${raw}`,
        };
      }
      parallelDownloads = Math.floor(n);
      continue;
    }
    // Unknown flags: ignore soft for now (APM subset); do not fail as "unknown command"
  }

  return { updateRefs, verbose, parallelDownloads };
}

export async function runLock(deps: LockDeps, options: LockOptions): Promise<LockResult> {
  const parsed = parseLockArgs(options.args ?? []);
  if (parsed.error) {
    return { ok: false, exitCode: 1, message: parsed.error };
  }

  try {
    const result = await deps.resolveAndLock({
      cwd: options.cwd,
      updateRefs: options.updateRefs ?? parsed.updateRefs,
      verbose: options.verbose ?? parsed.verbose,
      parallelDownloads: options.parallelDownloads ?? parsed.parallelDownloads,
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
