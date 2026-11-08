/**
 * CLI Auth module — read-only credential resolution/reporting for `bapm auth`.
 */
import {
  authCheckEndpoint,
  classifyAuthProbeStatus,
  formatAuthHelp,
  formatExportLine,
  parseAuthArgs,
  runAuthCli,
  type AuthCheckVerdict,
  type AuthCliDeps,
  type AuthOptions,
  type AuthProbeRequest,
  type AuthProbeResult,
  type AuthTokenProbe,
  type ParsedAuthArgs,
} from "./services/runAuth.ts";
import type { LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type {
  AuthCheckVerdict,
  AuthCliDeps,
  AuthOptions,
  AuthProbeRequest,
  AuthProbeResult,
  AuthTokenProbe,
  ParsedAuthArgs,
};

export {
  authCheckEndpoint,
  classifyAuthProbeStatus,
  formatAuthHelp,
  formatExportLine,
  parseAuthArgs,
  runAuthCli,
};

export function createAuth(deps: Partial<AuthCliDeps> = {}) {
  const resolved: AuthCliDeps = {
    name: deps.name ?? "bapm",
    manifestFile: deps.manifestFile ?? "bapm.yml",
    lockFile: deps.lockFile ?? "bapm.lock.yaml",
    ...(deps.env ? { env: deps.env } : {}),
    ...(deps.probe ? { probe: deps.probe } : {}),
  };

  return {
    async run(options: AuthOptions = {}): Promise<LifecycleResult> {
      return runAuthCli(resolved, options);
    },
    formatHelp(): string {
      return formatAuthHelp(resolved);
    },
  };
}

export type AuthApi = ReturnType<typeof createAuth>;
