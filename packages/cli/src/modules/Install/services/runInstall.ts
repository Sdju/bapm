import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  createDefaultDownloader,
  createDefaultGitRemote,
  createDefaultTagLister,
  resolveEffectiveFrozen,
  runInstall as coreRunInstall,
} from "@bapm/core";
import type { InstallDeps, InstallOptions, InstallResult } from "../types/install.types.ts";
import { registerManifestIntegrationsFromCwd } from "@/app/integrations/loadManifestIntegrations.ts";
import { createCliIntegrationRegistry } from "@/app/integrations/registry.ts";

export function formatInstallHelp(deps: InstallDeps): string {
  return `${deps.name} install — Install agentic dependencies from ${deps.manifestFile}

Usage:
  bapm install [options]
  bapm install <package-ref...>   Add package ref(s) to dependencies.apm (or --dev → devDependencies.apm), then install
  bapm install <archive.zip>      Install from a pack-produced plain zip archive

Options:
  --frozen                 Fail if lock is missing or pins drift; re-verify deployed_file_hashes when present
  --no-frozen              Opt out of frozen mode (including CI-default frozen)
  --dry-run                Preview direct deps / would-add; no durable project writes
  --force                  Accept force (overwrite / future security gates). Does not refresh refs and does not bypass frozen or policy
  --allow-insecure         Allow direct http:// deps that also set allow_insecure: true (dual consent)
  --allow-insecure-host <hostname>
                           Allow transitive http:// deps from this FQDN (repeatable)
  --dev                    With package-ref add: write under devDependencies.apm (no-op without positional)
  --only <apm|mcp>         Install only APM packages (skip MCP) or only MCP configure (skip APM materialize)
  --target <id>            Force activation of a registered host target (e.g. cursor)
  --exclude <id>           Skip MCP configure for runtime id (e.g. cursor); does not skip install
  --update                 Re-resolve mutable refs (rejected with frozen / CI-default frozen)
  --parallel-downloads <n> Concurrent downloads (default 4; 0 = serial)
  -v, --verbose            Richer progress / diagnostics (does not weaken frozen/policy)
  --policy <path>          Use explicit policy file (wins over apm-policy.yml / bapm-policy.yml)
  --no-policy              Skip policy discovery and checks (also: BAPM_POLICY_DISABLE=1)
  --trust-transitive-mcp   Deploy MCP from dependencies (default: direct dependencies.mcp only)
  --help, -h               Show this help

Notes:
  Unknown flags are rejected. Combining --frozen with --no-frozen is an error.
  Combining frozen (explicit or CI-default) with --update is an error.
  Frozen integrity (lk-015/017/018) is kept; MCP config sync vs pins is optional/default-off.
  When the CI environment variable is truthy (not "", "0", or "false"), install
  defaults to frozen unless --no-frozen is passed (OpenAPM req-lk-018).
  A local .zip path is consumed as a pack archive (install-from-archive).
  Non-zip positionals are package refs added to dependencies.apm (auto-creates
  a minimal manifest when missing). Frozen rejects positional package-ref add.
  --exclude filters MCP/runtime configure only — not a full skip-install.
  --force is distinct from --target (forced-target activation).
  When cursor is active, eligible MCP servers write .cursor/mcp.json (direct mcp by default).
`;
}

export type ParseInstallArgsOptions = {
  /** Env overlay for CI-default frozen (defaults to `process.env`). */
  env?: Record<string, string | undefined>;
};

export type ParsedInstallArgs = {
  frozen: boolean;
  noFrozen: boolean;
  update: boolean;
  dryRun: boolean;
  verbose: boolean;
  force: boolean;
  allowInsecure: boolean;
  allowInsecureHosts?: string[];
  dev: boolean;
  only?: "apm" | "mcp";
  target?: string;
  archivePath?: string;
  packageRefs?: string[];
  exclude?: string[];
  parallelDownloads?: number;
  policyPath?: string;
  noPolicy: boolean;
  trustTransitiveMcp: boolean;
  help?: boolean;
  error?: string;
};

export function parseInstallArgs(
  argv: string[],
  options: ParseInstallArgsOptions = {},
): ParsedInstallArgs {
  let frozenFlag = false;
  let noFrozen = false;
  let update = false;
  let dryRun = false;
  let verbose = false;
  let force = false;
  let allowInsecure = false;
  const allowInsecureHosts: string[] = [];
  let dev = false;
  let only: "apm" | "mcp" | undefined;
  let target: string | undefined;
  let archivePath: string | undefined;
  const packageRefs: string[] = [];
  const exclude: string[] = [];
  let parallelDownloads: number | undefined;
  let policyPath: string | undefined;
  let noPolicy = false;
  let trustTransitiveMcp = false;
  let help = false;

  const partial = (): ParsedInstallArgs => ({
    frozen: frozenFlag,
    noFrozen,
    update,
    dryRun,
    verbose,
    force,
    allowInsecure,
    allowInsecureHosts: allowInsecureHosts.length > 0 ? [...allowInsecureHosts] : undefined,
    dev,
    only,
    target,
    archivePath,
    packageRefs: packageRefs.length > 0 ? [...packageRefs] : undefined,
    exclude: exclude.length > 0 ? [...exclude] : undefined,
    parallelDownloads,
    policyPath,
    noPolicy,
    trustTransitiveMcp,
  });

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--frozen") {
      frozenFlag = true;
      continue;
    }
    if (arg === "--no-frozen") {
      noFrozen = true;
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
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg === "--allow-insecure") {
      allowInsecure = true;
      continue;
    }
    if (arg === "--dev") {
      dev = true;
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
    if (arg === "--trust-transitive-mcp") {
      trustTransitiveMcp = true;
      continue;
    }
    if (arg === "--allow-insecure-host") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return {
          ...partial(),
          error: "Missing value for --allow-insecure-host <hostname>",
        };
      }
      const hostErr = validateInsecureHost(next);
      if (hostErr) return { ...partial(), error: hostErr };
      allowInsecureHosts.push(next.trim().toLowerCase());
      i += 1;
      continue;
    }
    if (arg.startsWith("--allow-insecure-host=")) {
      const host = arg.slice("--allow-insecure-host=".length);
      if (!host) {
        return {
          ...partial(),
          error: "Missing value for --allow-insecure-host=<hostname>",
        };
      }
      const hostErr = validateInsecureHost(host);
      if (hostErr) return { ...partial(), error: hostErr };
      allowInsecureHosts.push(host.trim().toLowerCase());
      continue;
    }
    if (arg === "--only") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return {
          ...partial(),
          error: "Missing value for --only <apm|mcp>",
        };
      }
      const onlyErr = validateOnlyValue(next);
      if (onlyErr) return { ...partial(), error: onlyErr };
      only = next as "apm" | "mcp";
      i += 1;
      continue;
    }
    if (arg.startsWith("--only=")) {
      const value = arg.slice("--only=".length);
      if (!value) {
        return {
          ...partial(),
          error: "Missing value for --only=<apm|mcp>",
        };
      }
      const onlyErr = validateOnlyValue(value);
      if (onlyErr) return { ...partial(), error: onlyErr };
      only = value as "apm" | "mcp";
      continue;
    }
    if (arg === "--policy") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return {
          ...partial(),
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
        return {
          ...partial(),
          error: "Missing value for --policy=<path>",
        };
      }
      continue;
    }
    if (arg === "--target") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return {
          ...partial(),
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
        return {
          ...partial(),
          error: "Missing value for --target=<id>",
        };
      }
      continue;
    }
    if (arg === "--exclude") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return {
          ...partial(),
          error: "Missing value for --exclude <id>",
        };
      }
      exclude.push(next);
      i += 1;
      continue;
    }
    if (arg.startsWith("--exclude=")) {
      const id = arg.slice("--exclude=".length);
      if (!id) {
        return {
          ...partial(),
          error: "Missing value for --exclude=<id>",
        };
      }
      exclude.push(id);
      continue;
    }
    if (arg === "--parallel-downloads") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        return {
          ...partial(),
          error: "Missing value for --parallel-downloads <n>",
        };
      }
      const n = Number(next);
      if (!Number.isFinite(n) || n < 0) {
        return {
          ...partial(),
          error: `Invalid --parallel-downloads value: ${next}`,
        };
      }
      parallelDownloads = Math.floor(n);
      i += 1;
      continue;
    }
    if (arg.startsWith("--parallel-downloads=")) {
      const raw = arg.slice("--parallel-downloads=".length);
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        return {
          ...partial(),
          error: `Invalid --parallel-downloads value: ${raw}`,
        };
      }
      parallelDownloads = Math.floor(n);
      continue;
    }
    if (arg.startsWith("-")) {
      return {
        ...partial(),
        error: `Unknown install flag: ${arg}`,
      };
    }
    // Positional: .zip → archive; otherwise package-ref. Mixing modes fails closed.
    if (looksLikeZipPositional(arg)) {
      if (packageRefs.length > 0) {
        return {
          ...partial(),
          error: "Cannot combine archive .zip with positional package refs",
        };
      }
      if (archivePath !== undefined) {
        return {
          ...partial(),
          error: `Unexpected argument: ${arg}`,
        };
      }
      archivePath = arg;
      continue;
    }
    if (archivePath !== undefined) {
      return {
        ...partial(),
        error: "Cannot combine archive .zip with positional package refs",
      };
    }
    packageRefs.push(arg);
  }

  if (frozenFlag && noFrozen) {
    return {
      ...partial(),
      error: "Cannot combine --frozen and --no-frozen (mutually exclusive flags conflict)",
    };
  }

  const env = options.env ?? (process.env as Record<string, string | undefined>);
  let frozen: boolean;
  try {
    frozen = resolveEffectiveFrozen({ frozen: frozenFlag, noFrozen, env });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...partial(), error: message };
  }

  if (frozen && update) {
    return {
      ...partial(),
      frozen,
      error: "Frozen mode rejects --update (frozen+update mutation rejected)",
    };
  }

  return {
    frozen,
    noFrozen,
    update,
    dryRun,
    verbose,
    force,
    allowInsecure,
    allowInsecureHosts: allowInsecureHosts.length > 0 ? allowInsecureHosts : undefined,
    dev,
    only,
    target,
    archivePath,
    packageRefs: packageRefs.length > 0 ? packageRefs : undefined,
    exclude: exclude.length > 0 ? exclude : undefined,
    parallelDownloads,
    policyPath,
    noPolicy,
    trustTransitiveMcp,
    help,
  };
}

const FQDN_RE =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;

function validateInsecureHost(hostname: string): string | undefined {
  const cleaned = hostname.trim().toLowerCase();
  if (!cleaned || !FQDN_RE.test(cleaned.split("/")[0]!)) {
    return `Invalid hostname '${hostname}'. Use a bare hostname like 'mirror.example.com'.`;
  }
  return undefined;
}

function validateOnlyValue(value: string): string | undefined {
  if (value === "apm" || value === "mcp") return undefined;
  return `Invalid --only value: ${value} (expected one of: apm, mcp)`;
}

function looksLikeZipPositional(candidate: string): boolean {
  return candidate.toLowerCase().endsWith(".zip");
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
  const parsed = parseInstallArgs(options.args ?? [], { env: options.env });
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
  parsed: ParsedInstallArgs,
  archivePath: string | undefined,
): Promise<InstallResult> {
  const registry = createCliIntegrationRegistry();
  const cwd = options.cwd ?? process.cwd();

  try {
    await registerManifestIntegrationsFromCwd(registry, cwd);
    const result = await coreRunInstall({
      cwd: options.cwd,
      archivePath,
      dryRun: parsed.dryRun,
      packageRefs: parsed.packageRefs,
      exclude: parsed.exclude,
      excludeTargets: parsed.exclude,
      parallelDownloads: parsed.parallelDownloads,
      verbose: parsed.verbose,
      frozen: parsed.frozen,
      updateRefs: parsed.update,
      update: parsed.update,
      force: parsed.force,
      allowInsecure: parsed.allowInsecure,
      allowInsecureHosts: parsed.allowInsecureHosts,
      dev: parsed.dev,
      only: parsed.only,
      forcedTarget: parsed.target,
      forceTarget: parsed.target,
      integrationRegistry: registry,
      policyPath: parsed.policyPath,
      policy: parsed.policyPath,
      noPolicy: parsed.noPolicy,
      trustTransitiveMcp: parsed.trustTransitiveMcp,
      gitRemote: createDefaultGitRemote(),
      tagLister: createDefaultTagLister(),
      downloader: createDefaultDownloader(),
    });
    emitPolicyDiagnostics(deps.name, result.policyDiagnostics ?? result.diagnostics);
    emitTrustDiagnostics(deps.name, result.diagnostics);
    if (parsed.dryRun || result.dryRun) {
      emitDryRunPreview(deps.name, result.diagnostics);
      console.log(`${deps.name}: dry-run preview complete; no changes made`);
    }
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

function emitDryRunPreview(name: string, diagnostics: unknown[]): void {
  for (const d of diagnostics) {
    if (!d || typeof d !== "object") continue;
    const rec = d as Record<string, unknown>;
    const code = typeof rec.code === "string" ? rec.code : "";
    const message = typeof rec.message === "string" ? rec.message : "";
    if (!/dry.?run|would|preview/i.test(`${code}\n${message}`)) continue;
    if (code === "DRY_RUN") continue;
    console.log(`${name}: ${message || code}`);
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

function emitTrustDiagnostics(name: string, diagnostics: unknown[]): void {
  for (const d of diagnostics) {
    if (!d || typeof d !== "object") continue;
    const rec = d as Record<string, unknown>;
    const code = typeof rec.code === "string" ? rec.code : "";
    const message = typeof rec.message === "string" ? rec.message : "";
    if (!/withhold|unapproved|mcp_trust|trust/i.test(`${code}\n${message}`)) continue;
    console.error(`${name}: ${message || code}`);
  }
}
