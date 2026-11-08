import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  loadEffectiveLockfileOrNull,
  persistUserExecutableGrant,
  type SaveUserExecutableGrantsOptions,
} from "@b-apm/core";
import type { LifecycleResult } from "@/common/types/lifecycle.types.ts";

/** Dependency-injected MCP-only apply used after a deny grant is persisted. */
export type DenyApplyOptions = {
  cwd: string;
  only: "mcp";
  /** Cleanup must not be blocked by repo/org policy discovery. */
  noPolicy: boolean;
};

export type DenyApplyResult = { ok?: boolean; message?: string } | unknown;

export type DenyCliDeps = {
  name: string;
  manifestFile: string;
  saveGrant?: (opts: SaveUserExecutableGrantsOptions) => unknown;
  /**
   * Re-run MCP configuration for active hosts so already-written entries for
   * the denied package are removed. Injected in CLI composition with the real
   * core install; omitted in unit tests that only assert grant persistence.
   */
  applyDenied?: (options: DenyApplyOptions) => Promise<DenyApplyResult>;
};

export const DENY_EXECUTABLE_TYPES = ["mcp", "lsp", "bin", "hook"] as const;
export type DenyExecutableType = (typeof DENY_EXECUTABLE_TYPES)[number];

export function formatDenyHelp(deps: DenyCliDeps): string {
  return `${deps.name} deny — Persist user-local executable deny

Usage:
  bapm deny <package-name> [--bin|--hook|--lsp|--mcp] [--user]

Persists a deny under ~/.bapm/config.json (executables.deny).
  --mcp    deny MCP servers (default)
  --lsp    deny LSP servers
  --bin    deny dependency bin/ executables
  --hook   deny dependency hooks
Multiple type flags persist each selected type. With no type flag, deny
defaults to --mcp (backward compatible).

After a --mcp deny, bapm reconfigures MCP for active hosts so matching
server entries are removed from host configs when possible. If a host config
cannot be rewritten, remove the server from that config manually.
Interactive deny NEVER writes project ${deps.manifestFile}.
`;
}

export function parseDenyArgs(argv: string[]): {
  help: boolean;
  packageName?: string;
  user: boolean;
  executableTypes: DenyExecutableType[];
} {
  let help = false;
  const positionals: string[] = [];
  const executableTypes: DenyExecutableType[] = [];
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--user") {
      // Interactive path is always user-local (sc-010); flag accepted for APM parity.
      continue;
    }
    if (arg === "--mcp" || arg === "--lsp" || arg === "--bin" || arg === "--hook") {
      const type = arg.slice(2) as DenyExecutableType;
      if (!executableTypes.includes(type)) executableTypes.push(type);
      continue;
    }
    if (arg.startsWith("-")) continue;
    positionals.push(arg);
  }
  return {
    help,
    packageName: positionals[0],
    user: true,
    executableTypes: executableTypes.length > 0 ? executableTypes : ["mcp"],
  };
}

function manualCleanupHint(name: string, packageName: string, reason: string): void {
  console.error(
    `${name}: warning: denied "${packageName}" in user config, but host MCP cleanup was skipped (${reason}). ` +
      `Remove the matching server entry from your agent MCP config manually.`,
  );
}

async function cleanupDeniedMcp(
  deps: DenyCliDeps,
  args: { cwd: string; packageName: string },
): Promise<void> {
  if (!deps.applyDenied) return;

  const manifestCandidates = [...new Set([deps.manifestFile, "apm.yml"])];
  const hasManifest = manifestCandidates.some((file) => existsSync(join(resolve(args.cwd), file)));
  if (!hasManifest) {
    manualCleanupHint(deps.name, args.packageName, "no project manifest found");
    return;
  }

  let hasLock = false;
  try {
    hasLock = loadEffectiveLockfileOrNull({ cwd: args.cwd }) !== null;
  } catch {
    hasLock = false;
  }
  if (!hasLock) {
    manualCleanupHint(deps.name, args.packageName, "no lockfile found");
    return;
  }

  try {
    const result = await deps.applyDenied({
      cwd: args.cwd,
      only: "mcp",
      noPolicy: true,
    });
    if (
      result !== null &&
      typeof result === "object" &&
      "ok" in result &&
      (result as { ok?: unknown }).ok === false
    ) {
      const message = (result as { message?: unknown }).message;
      manualCleanupHint(
        deps.name,
        args.packageName,
        typeof message === "string" && message.trim() ? message : "install reconfiguration failed",
      );
    }
  } catch (error) {
    manualCleanupHint(
      deps.name,
      args.packageName,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function runDenyCli(
  deps: DenyCliDeps,
  options: { args?: string[]; cwd?: string } = {},
): Promise<LifecycleResult> {
  const parsed = parseDenyArgs(options.args ?? []);
  if (parsed.help) {
    console.log(formatDenyHelp(deps));
    return { ok: true, exitCode: 0 };
  }
  const packageName = parsed.packageName?.trim();
  if (!packageName) {
    console.error(`${deps.name}: deny requires a package name`);
    console.log(formatDenyHelp(deps));
    return { ok: false, exitCode: 1 };
  }

  const save = deps.saveGrant ?? persistUserExecutableGrant;
  for (const executableType of parsed.executableTypes) {
    save({
      packageName,
      grant: "deny",
      executableType,
    });
  }
  console.log(
    `Denied "${packageName}" (${parsed.executableTypes.join(", ")}) in user config (~/.bapm/config.json)`,
  );

  if (parsed.executableTypes.includes("mcp")) {
    await cleanupDeniedMcp(deps, {
      cwd: resolve(options.cwd ?? process.cwd()),
      packageName,
    });
  }

  return { ok: true, exitCode: 0 };
}
