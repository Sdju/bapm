/**
 * CLI Run module — `bapm run` / `bapm preview` over manifest `scripts:`.
 */
import type { LifecycleResult } from "@/common/types/lifecycle.types.ts";
import {
  formatScriptHelp,
  runScriptCli,
  type RunCliDeps,
  type ScriptCommand,
  type ScriptOptions,
} from "./services/runScript.ts";

export type {
  ParsedScriptArgs,
  RunCliDeps,
  ScriptCommand,
  ScriptExec,
  ScriptExecOptions,
  ScriptExecResult,
  ScriptHelpDeps,
  ScriptManifestLoader,
  ScriptOptions,
} from "./services/runScript.ts";

export {
  formatScriptHelp,
  paramEnvironment,
  parseScriptArgs,
  runScriptCli,
  shellQuote,
  substituteScriptCommand,
} from "./services/runScript.ts";

export type ScriptApi = {
  run(options?: ScriptOptions): Promise<LifecycleResult>;
  formatHelp(): string;
};

function resolveDeps(deps: Partial<RunCliDeps>): RunCliDeps {
  return {
    name: deps.name ?? "bapm",
    manifestFile: deps.manifestFile ?? "bapm.yml",
    lockFile: deps.lockFile ?? "bapm.lock.yaml",
    ...(deps.loadProject ? { loadProject: deps.loadProject } : {}),
    ...(deps.exec ? { exec: deps.exec } : {}),
    ...(deps.env ? { env: deps.env } : {}),
    ...(deps.platform ? { platform: deps.platform } : {}),
  };
}

function createScriptModule(deps: Partial<RunCliDeps>, command: ScriptCommand): ScriptApi {
  const resolved = resolveDeps(deps);
  return {
    async run(options: ScriptOptions = {}): Promise<LifecycleResult> {
      return runScriptCli(resolved, command, options);
    },
    formatHelp(): string {
      return formatScriptHelp(resolved, command);
    },
  };
}

export function createRun(deps: Partial<RunCliDeps> = {}): ScriptApi {
  return createScriptModule(deps, "run");
}

export function createPreview(deps: Partial<RunCliDeps> = {}): ScriptApi {
  return createScriptModule(deps, "preview");
}

export type RunApi = ScriptApi;
export type PreviewApi = ScriptApi;
