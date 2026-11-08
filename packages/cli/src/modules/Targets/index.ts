import { formatTargetsHelp, parseTargetsArgs, runTargetsCli } from "./services/runTargets.ts";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type { LifecycleCliDeps, LifecycleResult };
export type { ParsedTargetsArgs, TargetRow, TargetsCliDeps } from "./services/runTargets.ts";
export { formatTargetsHelp, parseTargetsArgs };

export function createTargets(deps?: LifecycleCliDeps) {
  const resolved: LifecycleCliDeps = deps ?? {
    name: "bapm",
    manifestFile: "bapm.yml",
    lockFile: "bapm.lock.yaml",
  };
  return {
    async run(options: { args?: string[]; cwd?: string }): Promise<LifecycleResult> {
      return runTargetsCli(resolved, options);
    },
    formatHelp(): string {
      return formatTargetsHelp(resolved);
    },
  };
}

export type TargetsApi = ReturnType<typeof createTargets>;
