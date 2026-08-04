import {
  createDefaultDownloader,
  createDefaultGitRemote,
  createDefaultTagLister,
  runUpdate as coreRunUpdate,
} from "@bapm/core";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";
import { createInterface } from "node:readline";

export type UpdateOptions = { args?: string[]; cwd?: string };

export function parseUpdateArgs(argv: string[]): {
  yes: boolean;
  dryRun: boolean;
  packages: string[];
  policyPath?: string;
  noPolicy: boolean;
  help?: boolean;
  error?: string;
} {
  let yes = false;
  let dryRun = false;
  let help = false;
  let policyPath: string | undefined;
  let noPolicy = false;
  const packages: string[] = [];

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
    if (arg === "--no-policy") {
      noPolicy = true;
      continue;
    }
    if (arg === "--policy") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return { yes, dryRun, packages, noPolicy, error: "Missing value for --policy <path>" };
      }
      policyPath = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--policy=")) {
      policyPath = arg.slice("--policy=".length);
      if (!policyPath) {
        return { yes, dryRun, packages, noPolicy, error: "Missing value for --policy=<path>" };
      }
      continue;
    }
    if (arg.startsWith("-")) {
      return { yes, dryRun, packages, noPolicy, policyPath, error: `Unknown update flag: ${arg}` };
    }
    packages.push(arg);
  }
  return { yes, dryRun, packages, policyPath, noPolicy, help };
}

export function formatUpdateHelp(deps: LifecycleCliDeps): string {
  return `${deps.name} update — Re-resolve dependency pins (rs-011/rs-012)

Usage:
  bapm update [packages...] [options]

Options:
  -y, --yes       Apply without interactive confirm
  --dry-run       Print plan only; do not mutate lock/modules
  --policy <path> Use explicit policy file
  --no-policy     Skip policy discovery and checks
  --help, -h      Show this help
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
