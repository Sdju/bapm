/**
 * Shared fixtures for integration-api-hook-helpers acceptance.
 */
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as apiNamespace from "../../../src/index.ts";

export const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const repoRoot = resolve(pkgRoot, "../..");

/** Expected public shape once apply lands (cast so RED suite typechecks before exports exist). */
export type HookOwnershipSidecar = {
  owned: Record<
    string,
    {
      packageName?: string;
      entries?: Array<{ event: string; command: string }>;
      scripts?: string[];
      hookFile?: string;
      hookFiles?: string[];
    }
  >;
};

export type CopyHookScriptArgs = {
  cwd: string;
  deployRoots: string[];
  hookFile: string;
  command: string;
  alreadyDeployedNeedle: string;
  destRel: string;
  commandAsDotSlash?: boolean;
};

export type CopyHookScriptResult = {
  commandRel: string;
  scriptRel?: string;
};

type HookHelpersApi = {
  readHookOwnershipSidecar: (path: string) => HookOwnershipSidecar;
  writeHookOwnershipSidecar: (path: string, doc: HookOwnershipSidecar) => void;
  stripOwnedHookCommands: (hooks: Record<string, unknown>, ownership: HookOwnershipSidecar) => void;
  removeOwnedHookArtifacts: (cwd: string, ownership: HookOwnershipSidecar) => void;
  copyHookScript: (args: CopyHookScriptArgs) => CopyHookScriptResult;
};

export const api = apiNamespace as typeof apiNamespace & HookHelpersApi;

export function tempCwd(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function writeText(abs: string, content: string): void {
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, "utf8");
}

export function hostSrc(pkg: string, file: string): string {
  return join(repoRoot, "packages", pkg, "src", file);
}
