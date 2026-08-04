import { formatDepsHelp, parseDepsArgs, runDepsCli } from "./services/runDeps.ts";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type { LifecycleCliDeps, LifecycleResult };
export { formatDepsHelp, parseDepsArgs };

export function createDeps(deps?: LifecycleCliDeps) {
  const resolved: LifecycleCliDeps = deps ?? {
    name: "bapm",
    manifestFile: "bapm.yml",
    lockFile: "bapm.lock.yaml",
  };
  return {
    async run(options: { args?: string[]; cwd?: string }): Promise<LifecycleResult> {
      return runDepsCli(resolved, options);
    },
    formatHelp(): string {
      return formatDepsHelp(resolved);
    },
  };
}

export type DepsApi = ReturnType<typeof createDeps>;
