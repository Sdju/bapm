import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  createDefaultDownloader,
  createDefaultGitRemote,
  createDefaultTagLister,
  runInstall as coreRunInstall,
} from "@bapm/core";
import { createTargetRegistry } from "bapm-target-api";
import { createCursorTarget } from "bapm-target-cursor";
import type { InstallDeps, InstallOptions, InstallResult } from "../types/install.types.ts";

export function formatInstallHelp(deps: InstallDeps): string {
  return `${deps.name} install — Install agentic dependencies from ${deps.manifestFile}

Usage:
  bapm install [options]
  bapm install <archive.zip>   Install from a pack-produced plain zip archive

Options:
  --frozen          Fail if lock is missing or pins drift; re-verify deployed_file_hashes when present
  --target <id>     Force activation of a registered host target (e.g. cursor)
  --update          Re-resolve mutable refs (rejected with --frozen)
  --help, -h        Show this help

Notes:
  Unknown flags are rejected. Combining --frozen with --update is an error.
  A local .zip path is consumed as a pack archive (install-from-archive).
`;
}

export function parseInstallArgs(argv: string[]): {
  frozen: boolean;
  update: boolean;
  target?: string;
  archivePath?: string;
  help?: boolean;
  error?: string;
} {
  let frozen = false;
  let update = false;
  let target: string | undefined;
  let archivePath: string | undefined;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--frozen") {
      frozen = true;
      continue;
    }
    if (arg === "--update") {
      update = true;
      continue;
    }
    if (arg === "--target") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return {
          frozen,
          update,
          error: "Missing value for --target <id>",
        };
      }
      target = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--target=")) {
      target = arg.slice("--target=".length);
      if (!target) {
        return { frozen, update, error: "Missing value for --target=<id>" };
      }
      continue;
    }
    if (arg.startsWith("-")) {
      return {
        frozen,
        update,
        target,
        error: `Unknown install flag: ${arg}`,
      };
    }
    // Positional: local .zip pack archive wins over package-ref parse
    if (archivePath !== undefined) {
      return {
        frozen,
        update,
        target,
        archivePath,
        error: `Unexpected argument: ${arg}`,
      };
    }
    archivePath = arg;
  }

  if (frozen && update) {
    return {
      frozen,
      update,
      target,
      archivePath,
      error: "Frozen mode rejects --update (frozen+update mutation rejected)",
    };
  }

  return { frozen, update, target, archivePath, help };
}

function resolveLocalZipArchive(
  candidate: string | undefined,
  cwd: string | undefined,
): string | undefined {
  if (!candidate) return undefined;
  const abs = resolve(cwd ?? process.cwd(), candidate);
  if (!existsSync(abs)) return undefined;
  try {
    if (!statSync(abs).isFile()) return undefined;
  } catch {
    return undefined;
  }
  if (!abs.toLowerCase().endsWith(".zip")) return undefined;
  return abs;
}

export async function runInstall(
  deps: InstallDeps,
  options: InstallOptions,
): Promise<InstallResult> {
  const parsed = parseInstallArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatInstallHelp(deps));
    return { ok: true };
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, message: parsed.error };
  }

  const archivePath = resolveLocalZipArchive(parsed.archivePath, options.cwd);
  if (parsed.archivePath && !archivePath) {
    // Explicit path that looks like zip but is missing / not a file — still try core
    // with resolved path so corrupt/missing fails closed with install error.
    const attempted = resolve(options.cwd ?? process.cwd(), parsed.archivePath);
    if (parsed.archivePath.toLowerCase().endsWith(".zip")) {
      // Pass through so core extract fails closed on corrupt/missing.
      return runCoreInstall(deps, options, parsed, attempted);
    }
    const message = `Unknown install argument (expected options or a local .zip): ${parsed.archivePath}`;
    console.error(`${deps.name}: ${message}`);
    return { ok: false, message };
  }

  return runCoreInstall(deps, options, parsed, archivePath);
}

async function runCoreInstall(
  deps: InstallDeps,
  options: InstallOptions,
  parsed: {
    frozen: boolean;
    update: boolean;
    target?: string;
  },
  archivePath: string | undefined,
): Promise<InstallResult> {
  const registry = createTargetRegistry();
  registry.register(createCursorTarget());

  try {
    await coreRunInstall({
      cwd: options.cwd,
      archivePath,
      frozen: parsed.frozen,
      updateRefs: parsed.update,
      update: parsed.update,
      forcedTarget: parsed.target,
      forceTarget: parsed.target,
      targetRegistry: registry,
      gitRemote: createDefaultGitRemote(),
      tagLister: createDefaultTagLister(),
      downloader: createDefaultDownloader(),
    });
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : String(error);
    console.error(`${deps.name}: ${message}`);
    return { ok: false, message };
  }
}
