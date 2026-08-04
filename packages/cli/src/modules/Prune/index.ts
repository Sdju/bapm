import { formatPruneHelp, parsePruneArgs, runPruneCli } from "./services/runPrune.ts";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type { LifecycleCliDeps, LifecycleResult };
export { formatPruneHelp, parsePruneArgs };

export function createPrune(deps?: LifecycleCliDeps) {
  const resolved: LifecycleCliDeps = deps ?? {
    name: "bapm",
    manifestFile: "bapm.yml",
    lockFile: "bapm.lock.yaml",
  };
  return {
    async run(options: { args?: string[]; cwd?: string }): Promise<LifecycleResult> {
      return runPruneCli(resolved, options);
    },
    formatHelp(): string {
      return formatPruneHelp(resolved);
    },
  };
}

export type PruneApi = ReturnType<typeof createPrune>;
