import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  createDefaultDownloader,
  createDefaultGitRemote,
  createDefaultTagLister,
  createMcpRegistryClient,
  extractPackArchive,
  loadManifest,
  resolveEffectiveFrozen,
  runInstall as coreRunInstall,
} from "@b-apm/core";
import type { InstallDeps, InstallOptions, InstallResult } from "../types/install.types.ts";
import {
  createCliIntegrationRegistry,
  registerManifestIntegrationsFromCwd,
} from "@/modules/Integrations";
import { enrichUnregisteredTargetMessage } from "@/common/enrichUnregisteredTargetMessage.ts";
import { formatErrorCauseChain, formatErrorMessage } from "@/common/formatErrorCauseChain.ts";
import { resolvePolicyPorts } from "@/common/policyFetcher.ts";
import { readConfiguredMcpRegistryUrl, readConfiguredTarget } from "@/modules/Config";
import { ensureGlobalProject, resolveGlobalProjectRoot } from "@/common/globalProject.ts";

export function formatInstallHelp(deps: InstallDeps): string {
  return `${deps.name} install — Install agentic dependencies from ${deps.manifestFile}

Usage:
  bapm install [options]
  bapm install <package-ref...>   Add package ref(s) to dependencies.apm (or --dev → devDependencies.apm), then install
  bapm install <archive.zip>      Install from a pack-produced plain zip archive
  bapm install -g                 Install user-global packages + file primitives from ~/.bapm
  bapm install -g --only mcp      Configure user-global MCP from ~/.bapm (BAPM_HOME override)

Options:
  --global, -g             Use the user-global project root (~/.bapm, or BAPM_HOME)
                           for bapm.yml/bapm.lock.yaml and deploy file primitives
                           into the user's home harness dirs (~/.cursor, ~/.claude,
                           ~/.codex, ~/.agents). Supported file hosts: cursor,
                           claude, codex, agent-skills. Global MCP: cursor,
                           opencode.
  --mcp                    Alias for --only mcp.
  --frozen                 Fail if lock is missing or pins drift; re-verify deployed_file_hashes when present
  --no-frozen              Opt out of frozen mode (including CI-default frozen)
  --dry-run                Preview direct deps / would-add; no durable project writes
  --force                  Accepted for APM compatibility only; has no effect (does not refresh refs or bypass frozen/policy)
  --allow-insecure         Allow direct http:// deps that also set allow_insecure: true (dual consent)
  --allow-insecure-host <hostname>
                           Allow transitive http:// deps from this FQDN (repeatable)
  --dev                    With package-ref add: write under devDependencies.apm (no-op without positional)
  --only <apm|mcp>         Install only APM packages (skip MCP) or only MCP configure (skip APM materialize)
  --target <id>            Force activation of a registered host target (overrides manifest active)
  --exclude <id>[,<id>]    Skip MCP configure for runtime ids (repeatable; comma list); does not skip install
  --update                 Re-resolve mutable refs (rejected with frozen / CI-default frozen)
  --parallel-downloads <n> Concurrent downloads (default 4; 0 = serial)
  -v, --verbose            Richer progress / diagnostics (does not weaken frozen/policy)
  --policy <path>          Use explicit policy file (wins over apm-policy.yml / bapm-policy.yml)
  --no-policy              Skip repository-local policy only; org/remote deny still applies
  --no-policy-all          Full escape: skip local and org policy (also: BAPM_POLICY_DISABLE=1)
  --trust-transitive-mcp   Deploy MCP from dependencies (default: direct dependencies.mcp only)
  --trust-bin              Consent to deploy dependency/plugin bin/ for this run (when policy allows)
  --no-trust-bin           Skip bin/ deploy for this run (even when policy would allow)
  --help, -h               Show this help

Notes:
  Unknown flags are rejected. Combining --frozen with --no-frozen is an error.
  Combining --trust-bin with --no-trust-bin is an error.
  Combining frozen (explicit or CI-default) with --update is an error.
  Frozen re-verifies lock pins, deployed file hashes and package tree hashes.
  When the CI environment variable is truthy (not "", "0", or "false"), install
  defaults to frozen unless --no-frozen is passed.
  All installs (interactive and non-interactive) skip dependency bin/ unless
  --trust-bin or a persisted executables.allow bin grant applies. An interactive
  terminal is not implicit consent; pass --trust-bin or approve bin persistently.
  --trust-bin / --no-trust-bin are per-invocation consent and cannot override org/project deny.
  A local .zip path is installed as a pack archive: members are added to the current directory,
  nothing else is removed, and existing files with different content are never overwritten.
  Non-zip positionals are package refs added to dependencies.apm (auto-creates
  a minimal manifest when missing). Frozen rejects positional package-ref add.
  --exclude filters MCP/runtime configure only — not a full skip-install.
  Copilot and Windsurf write user-global MCP shared by every project; install warns
  with the path. Use --exclude copilot,windsurf or BAPM_NO_GLOBAL_MCP=1 to skip it.
  Host selection: --target <id> → local-overlay active → manifest active → config target → sole auto-detect → fail.
  Set active in bapm.yml / apm.yml when detect is missing or ambiguous.
  Eligible MCP servers are written to the active agent's MCP config (direct mcp by default).
  Global MCP: Cursor → ~/.cursor/mcp.json, OpenCode → ~/.config/opencode/opencode.json.
  Global files: Cursor → ~/.agents/skills + ~/.cursor, Claude → ~/.claude,
  Codex → ~/.agents/skills + ~/.codex, agent-skills → ~/.agents/skills.
  Global compile is not supported yet.
  Project manifests and locks are never read or written with --global.
`;
}

export type ParseInstallArgsOptions = {
  /** Env overlay for CI-default frozen (defaults to `process.env`). */
  env?: Record<string, string | undefined>;
};

export type ParsedInstallArgs = {
  global: boolean;
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
  /** Full escape (`--no-policy-all`): skip every policy source. */
  noPolicy: boolean;
  /** Repo-local escape (`--no-policy`): org/remote policy still applies. */
  noRepoPolicy: boolean;
  trustTransitiveMcp: boolean;
  /** Invocation bin consent: allow | deny | default. */
  trustBin: "allow" | "deny" | "default";
  help?: boolean;
  error?: string;
};

export function parseInstallArgs(
  argv: string[],
  options: ParseInstallArgsOptions = {},
): ParsedInstallArgs {
  let global = false;
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
  let noRepoPolicy = false;
  let trustTransitiveMcp = false;
  let trustBinAllow = false;
  let trustBinDeny = false;
  let help = false;

  const partial = (): ParsedInstallArgs => ({
    global,
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
    noRepoPolicy,
    trustTransitiveMcp,
    trustBin: trustBinAllow ? "allow" : trustBinDeny ? "deny" : "default",
  });

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--global" || arg === "-g") {
      global = true;
      continue;
    }
    if (arg === "--mcp") {
      if (only !== undefined && only !== "mcp") {
        return { ...partial(), error: "Cannot combine --mcp with --only apm" };
      }
      only = "mcp";
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
      noRepoPolicy = true;
      continue;
    }
    if (arg === "--no-policy-all") {
      noPolicy = true;
      continue;
    }
    if (arg === "--trust-transitive-mcp") {
      trustTransitiveMcp = true;
      continue;
    }
    if (arg === "--trust-bin") {
      trustBinAllow = true;
      continue;
    }
    if (arg === "--no-trust-bin") {
      trustBinDeny = true;
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

  if (trustBinAllow && trustBinDeny) {
    return {
      ...partial(),
      error: "Cannot combine --trust-bin and --no-trust-bin (mutually exclusive flags conflict)",
    };
  }

  const trustBin: "allow" | "deny" | "default" = trustBinAllow
    ? "allow"
    : trustBinDeny
      ? "deny"
      : "default";

  const env = options.env ?? (process.env as Record<string, string | undefined>);
  let frozen: boolean;
  try {
    frozen = resolveEffectiveFrozen({ frozen: frozenFlag, noFrozen, env });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...partial(), trustBin, error: message };
  }

  if (frozen && update) {
    return {
      ...partial(),
      frozen,
      trustBin,
      error: "Frozen mode rejects --update (frozen+update mutation rejected)",
    };
  }

  return {
    global,
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
    noRepoPolicy,
    trustTransitiveMcp,
    trustBin,
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

/**
 * Reconcile host MCP configs without resolving or deploying APM packages.
 * Used after a user-local deny so already-written servers disappear from host
 * configs. Policy discovery is skipped: this is a cleanup pass, not a deploy.
 */
export async function runMcpReconfigure(options: { cwd?: string } = {}): Promise<{
  ok: boolean;
  message?: string;
}> {
  const cwd = options.cwd ?? process.cwd();
  const registry = createCliIntegrationRegistry();
  try {
    await registerManifestIntegrationsFromCwd(registry, cwd);
    await coreRunInstall({
      cwd,
      only: "mcp",
      noPolicy: true,
      integrationRegistry: registry,
      configTarget: readConfiguredTarget(),
      env: process.env as Record<string, string | undefined>,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: formatErrorMessage(error) };
  }
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
  if (parsed.force) {
    console.error(
      `${deps.name}: warning: --force has no effect in this version; use --update to refresh refs, --trust-bin for bin consent, or remove the flag`,
    );
  }
  if (parsed.error) {
    console.error(`${deps.name}: ${parsed.error}`);
    return { ok: false, message: parsed.error };
  }

  let effectiveOptions = options;
  const effectiveParsed = parsed;
  if (parsed.global) {
    if (parsed.archivePath) {
      const message =
        "--global does not install archive .zip files; archive install is project-scoped.";
      console.error(`${deps.name}: ${message}`);
      return { ok: false, message };
    }

    const globalRoot = resolveGlobalProjectRoot(options.env);
    if (!parsed.dryRun) {
      try {
        ensureGlobalProject(globalRoot);
      } catch (error) {
        const message = formatErrorMessage(error);
        console.error(`${deps.name}: ${message}`);
        return { ok: false, message };
      }
    }
    effectiveOptions = {
      ...options,
      cwd: globalRoot,
      // Manifest/lock resolve under the global root; file primitives and hooks
      // deploy into the user home harness layout.
      deployCwd: homedir(),
      configDir: globalRoot,
      marketplaceConfigDir: globalRoot,
    };
  }

  const archivePath = resolveLocalZipArchive(effectiveParsed.archivePath, effectiveOptions.cwd);
  if (effectiveParsed.archivePath && !archivePath) {
    // Explicit path that looks like zip but is missing / not a file — still try core
    // with resolved path so corrupt/missing fails closed with install error.
    const attempted = resolve(effectiveOptions.cwd ?? process.cwd(), effectiveParsed.archivePath);
    if (effectiveParsed.archivePath.toLowerCase().endsWith(".zip")) {
      // Pass through so core extract fails closed on corrupt/missing.
      return runCoreInstall(deps, effectiveOptions, effectiveParsed, attempted);
    }
    const message = `Unknown install argument (expected options or a local .zip): ${effectiveParsed.archivePath}`;
    console.error(`${deps.name}: ${message}`);
    return { ok: false, message };
  }

  return runCoreInstall(deps, effectiveOptions, effectiveParsed, archivePath);
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
    // Land archive before object-map load so packaged `targets:` can register hosts.
    let archiveLanded = false;
    if (archivePath && !parsed.dryRun) {
      try {
        await extractPackArchive({ archivePath, outputDir: cwd, cwd });
        loadManifest({ cwd });
      } catch (cause) {
        const detail = cause instanceof Error ? cause.message : String(cause);
        throw new Error(`Install from archive failed: ${detail}`);
      }
      archiveLanded = true;
    }

    await registerManifestIntegrationsFromCwd(registry, cwd);
    const result = await coreRunInstall({
      cwd,
      deployCwd: options.deployCwd,
      scope: parsed.global ? "global" : "project",
      archivePath: archiveLanded ? undefined : archivePath,
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
      configTarget: readConfiguredTarget(
        options.configDir ? { configRoot: options.configDir } : undefined,
      ),
      integrationRegistry: registry,
      policyPath: parsed.policyPath,
      policy: parsed.policyPath,
      noPolicy: parsed.noPolicy,
      noRepoPolicy: parsed.noRepoPolicy,
      ...resolvePolicyPorts({
        noPolicy: parsed.noPolicy,
        env: options.env,
        policyPorts: options.policyPorts,
      }),
      trustTransitiveMcp: parsed.trustTransitiveMcp,
      trustBin: parsed.trustBin,
      configDir: options.configDir,
      marketplaceConfigDir: options.marketplaceConfigDir,
      env: options.env ?? (process.env as Record<string, string | undefined>),
      mcpRegistry: {
        // Lazy: installs without registry-only MCP entries never validate or
        // contact the MCP registry.
        getServer(name: string, lookupOptions?: { version?: string; registryUrl?: string }) {
          const client = createMcpRegistryClient({
            configuredUrl: readConfiguredMcpRegistryUrl(),
            env: options.env ?? (process.env as Record<string, string | undefined>),
          });
          return client.getServer(name, lookupOptions);
        },
      },
      gitRemote: createDefaultGitRemote(),
      tagLister: createDefaultTagLister(),
      downloader: createDefaultDownloader(),
    });
    const policyEmitted = emitPolicyDiagnostics(
      deps.name,
      result.policyDiagnostics ?? result.diagnostics,
    );
    const trustEmitted = emitTrustDiagnostics(deps.name, result.diagnostics);
    emitDiagnosticWarnings(deps.name, result.diagnostics, policyEmitted, trustEmitted);
    if (parsed.dryRun || result.dryRun) {
      emitDryRunPreview(deps.name, result.diagnostics);
      console.log(
        `${deps.name}: dry-run preview complete; no changes made${parsed.global ? " (global scope)" : ""}`,
      );
    } else if (result.activeTargets && result.activeTargets.length > 0) {
      console.log(
        `${deps.name}: installed for ${result.activeTargets.join(", ")}${parsed.global ? " (global scope)" : ""}`,
      );
    }
    return { ok: true };
  } catch (error) {
    const raw = formatErrorMessage(error);
    const message = enrichUnregisteredTargetMessage(raw, cwd);
    const rendered = formatErrorCauseChain(error, {
      verbose: parsed.verbose,
      message,
    });
    console.error(`${deps.name}: ${rendered}`);
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

function emitPolicyDiagnostics(name: string, diagnostics: unknown[]): Set<string> {
  const emitted = new Set<string>();
  for (const d of diagnostics) {
    if (!d || typeof d !== "object") continue;
    const rec = d as Record<string, unknown>;
    const code = typeof rec.code === "string" ? rec.code : "";
    const message = typeof rec.message === "string" ? rec.message : "";
    if (!/policy|enforcement|violat|denied/i.test(`${code}\n${message}`)) continue;
    console.error(`${name}: policy warning: ${message || code}`);
    emitted.add(message || code);
  }
  return emitted;
}

function emitTrustDiagnostics(name: string, diagnostics: unknown[]): Set<string> {
  const emitted = new Set<string>();
  for (const d of diagnostics) {
    if (!d || typeof d !== "object") continue;
    const rec = d as Record<string, unknown>;
    const code = typeof rec.code === "string" ? rec.code : "";
    const message = typeof rec.message === "string" ? rec.message : "";
    if (!/withhold|unapproved|mcp_trust|trust/i.test(`${code}\n${message}`)) continue;
    console.error(`${name}: ${message || code}`);
    emitted.add(message || code);
  }
  return emitted;
}

/**
 * Surface adapter/selection diagnostics that are warnings even when they do not
 * match the policy/trust message filters — skipped primitives, opt-in MCP
 * directory skips, and target allow-list filtering. Dedupe against the policy
 * and trust emitters so one diagnostic never prints twice.
 */
function emitDiagnosticWarnings(
  name: string,
  diagnostics: unknown[],
  policyEmitted: Set<string>,
  trustEmitted: Set<string>,
): void {
  const emitted = new Set<string>([...policyEmitted, ...trustEmitted]);
  for (const d of diagnostics) {
    if (!d || typeof d !== "object") continue;
    const rec = d as Record<string, unknown>;
    const code = typeof rec.code === "string" ? rec.code : "";
    const message = typeof rec.message === "string" ? rec.message : "";
    const text = message || code;
    if (!text || emitted.has(text)) continue;
    if (!isWarningDiagnostic(rec, code)) continue;
    emitted.add(text);
    console.error(`${name}: warning: ${text}`);
  }
}

function isWarningDiagnostic(rec: Record<string, unknown>, code: string): boolean {
  if (rec.warn === true) return true;
  const normalized = code.toUpperCase();
  if (!normalized) return false;
  return (
    /_UNSUPPORTED(?:$|_)/.test(normalized) ||
    /MCP_DIR_/.test(normalized) ||
    /_MCP_SKIP_NO_.*_DIR$/.test(normalized) ||
    /_SKIP_/.test(normalized)
  );
}
