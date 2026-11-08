import {
  RUNTIME_DESCRIPTORS,
  formatRuntimeHelp,
  listRuntimes,
  parseRuntimeArgs,
  runRuntimeCli,
  type ParsedRuntimeArgs,
  type RuntimeDeps,
  type RuntimeDescriptor,
  type RuntimeEnv,
  type RuntimeName,
  type RuntimeOptions,
  type RuntimeRow,
  type RuntimeSource,
  type RuntimeStatus,
  type RuntimeSummary,
} from "./services/runRuntime.ts";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type { LifecycleCliDeps, LifecycleResult };
export type {
  ParsedRuntimeArgs,
  RuntimeDeps,
  RuntimeDescriptor,
  RuntimeEnv,
  RuntimeName,
  RuntimeOptions,
  RuntimeRow,
  RuntimeSource,
  RuntimeStatus,
  RuntimeSummary,
};

export { RUNTIME_DESCRIPTORS, formatRuntimeHelp, listRuntimes, parseRuntimeArgs, runRuntimeCli };

export function createRuntime(deps?: Partial<RuntimeDeps>) {
  const resolved: RuntimeDeps = {
    name: deps?.name ?? "bapm",
    manifestFile: deps?.manifestFile ?? "bapm.yml",
    lockFile: deps?.lockFile ?? "bapm.lock.yaml",
    ...(deps?.env ? { env: deps.env } : {}),
    ...(deps?.homeDir ? { homeDir: deps.homeDir } : {}),
    ...(deps?.runtimeDirs ? { runtimeDirs: deps.runtimeDirs } : {}),
    ...(deps?.isFile ? { isFile: deps.isFile } : {}),
    ...(deps?.which ? { which: deps.which } : {}),
    ...(deps?.readVersion ? { readVersion: deps.readVersion } : {}),
  };

  return {
    async run(options: RuntimeOptions = {}): Promise<LifecycleResult> {
      return runRuntimeCli(resolved, options);
    },
    formatHelp(): string {
      return formatRuntimeHelp(resolved);
    },
    list(): RuntimeRow[] {
      return listRuntimes(resolved);
    },
  };
}

export type RuntimeApi = ReturnType<typeof createRuntime>;
