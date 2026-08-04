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
  --policy <path>   Use explicit policy file (wins over apm-policy.yml / bapm-policy.yml)
  --no-policy       Skip policy discovery and checks (also: BAPM_POLICY_DISABLE=1)
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
  policyPath?: string;
  noPolicy: boolean;
  help?: boolean;
  error?: string;
} {
  let frozen = false;
  let update = false;
  let target: string | undefined;
  let archivePath: string | undefined;
  let policyPath: string | undefined;
  let noPolicy = false;
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
    if (arg === "--no-policy") {
      noPolicy = true;
      continue;
    }
    if (arg === "--policy") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return {
          frozen,
          update,
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
        return { frozen, update, noPolicy, error: "Missing value for --policy=<path>" };
      }
      continue;
    }
    if (arg === "--target") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return {
          frozen,
          update,
          noPolicy,
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
        return { frozen, update, noPolicy, error: "Missing value for --target=<id>" };
      }
      continue;
    }
    if (arg.startsWith("-")) {
      return {
        frozen,
        update,
        target,
        noPolicy,
        policyPath,
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
        noPolicy,
        policyPath,
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
      noPolicy,
      policyPath,
      error: "Frozen mode rejects --update (frozen+update mutation rejected)",
    };
  }

  return { frozen, update, target, archivePath, policyPath, noPolicy, help };
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
    policyPath?: string;
    noPolicy: boolean;
  },
  archivePath: string | undefined,
): Promise<InstallResult> {
  const registry = createTargetRegistry();
  registry.register(createCursorTarget());

  try {
    const result = await coreRunInstall({
      cwd: options.cwd,
      archivePath,
      frozen: parsed.frozen,
      updateRefs: parsed.update,
      update: parsed.update,
      forcedTarget: parsed.target,
      forceTarget: parsed.target,
      targetRegistry: registry,
      policyPath: parsed.policyPath,
      policy: parsed.policyPath,
      noPolicy: parsed.noPolicy,
      gitRemote: createDefaultGitRemote(),
      tagLister: createDefaultTagLister(),
      downloader: createDefaultDownloader(),
    });
    emitPolicyDiagnostics(deps.name, result.policyDiagnostics ?? result.diagnostics);
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

function emitPolicyDiagnostics(name: string, diagnostics: unknown[]): void {
  for (const d of diagnostics) {
    if (!d || typeof d !== "object") continue;
    const rec = d as Record<string, unknown>;
    const code = typeof rec.code === "string" ? rec.code : "";
    const message = typeof rec.message === "string" ? rec.message : "";
    if (!/policy|enforcement|violat|denied/i.test(`${code}\n${message}`)) continue;
    console.error(`${name}: policy warning: ${message || code}`);
  }
}
