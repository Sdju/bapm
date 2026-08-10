import {
  createDefaultDownloader,
  createDefaultGitRemote,
  createDefaultTagLister,
  runUpdate as coreRunUpdate,
} from "@b-apm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";
import { createInterface } from "node:readline";

export type UpdateOptions = { args?: string[]; cwd?: string };

export type ParsedUpdateArgs = {
  yes: boolean;
  dryRun: boolean;
  verbose: boolean;
  packages: string[];
  parallelDownloads?: number;
  policyPath?: string;
  noPolicy: boolean;
  help?: boolean;
  error?: string;
};

export function parseUpdateArgs(argv: string[]): ParsedUpdateArgs {
  let yes = false;
  let dryRun = false;
  let verbose = false;
  let help = false;
  let policyPath: string | undefined;
  let noPolicy = false;
  let parallelDownloads: number | undefined;
  const packages: string[] = [];

  const partial = (): ParsedUpdateArgs => ({
    yes,
    dryRun,
    verbose,
    packages,
    parallelDownloads,
    policyPath,
    noPolicy,
  });

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--yes" || arg === "-y") {
      yes = true;
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
    if (arg === "--no-policy") {
      noPolicy = true;
      continue;
    }
    if (arg === "--policy") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return { ...partial(), error: "Missing value for --policy <path>" };
      }
      policyPath = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--policy=")) {
      policyPath = arg.slice("--policy=".length);
      if (!policyPath) {
        return { ...partial(), error: "Missing value for --policy=<path>" };
      }
      continue;
    }
    if (arg === "--parallel-downloads") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        return { ...partial(), error: "Missing value for --parallel-downloads <n>" };
      }
      const n = Number(next);
      if (!Number.isFinite(n) || n < 0) {
        return { ...partial(), error: `Invalid --parallel-downloads value: ${next}` };
      }
      parallelDownloads = Math.floor(n);
      i += 1;
      continue;
    }
    if (arg.startsWith("--parallel-downloads=")) {
      const raw = arg.slice("--parallel-downloads=".length);
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        return { ...partial(), error: `Invalid --parallel-downloads value: ${raw}` };
      }
      parallelDownloads = Math.floor(n);
      continue;
    }
    if (arg.startsWith("-")) {
      return { ...partial(), error: `Unknown update flag: ${arg}` };
    }
    packages.push(arg);
  }
  return { yes, dryRun, verbose, packages, parallelDownloads, policyPath, noPolicy, help };
}

export function formatUpdateHelp(deps: LifecycleCliDeps): string {
  return `${deps.name} update — Re-resolve dependency pins (rs-011/rs-012)

Usage:
  bapm update [packages...] [options]

Options:
  -y, --yes                Apply without interactive confirm
  --dry-run                Print plan only; do not mutate lock/modules
  -v, --verbose            Include keep/[=] rows in plan text
  --parallel-downloads <n> Concurrent downloads (default 4; 0 = serial)
  --policy <path>          Use explicit policy file
  --no-policy              Skip policy discovery and checks
  --help, -h               Show this help
`;
}

async function promptConfirm(): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise<string>((resolve) => {
      rl.question("Apply? [y/N] ", resolve);
    });
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

export async function runUpdateCli(
  deps: LifecycleCliDeps,
  options: UpdateOptions,
): Promise<LifecycleResult> {
  const parsed = parseUpdateArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatUpdateHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, exitCode: 1, message: parsed.error };
  }

  try {
    const result = await coreRunUpdate({
      cwd: options.cwd,
      yes: parsed.yes,
      dryRun: parsed.dryRun,
      verbose: parsed.verbose,
      parallelDownloads: parsed.parallelDownloads,
      packages: parsed.packages.length ? parsed.packages : undefined,
      scope: parsed.packages.length ? parsed.packages : undefined,
      policyPath: parsed.policyPath,
      policy: parsed.policyPath,
      noPolicy: parsed.noPolicy,
      gitRemote: createDefaultGitRemote(),
      tagLister: createDefaultTagLister(),
      downloader: createDefaultDownloader(),
      confirm: parsed.yes || parsed.dryRun ? undefined : promptConfirm,
      isTTY: process.stdin.isTTY,
    });
    if (result.text) console.log(result.text);
    return { ok: result.ok, exitCode: result.exitCode };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, exitCode: 1, message };
  }
}
