import { formatOutdatedHelp, parseOutdatedArgs, runOutdatedCli } from "./services/runOutdated.ts";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type { LifecycleCliDeps, LifecycleResult };
export { formatOutdatedHelp, parseOutdatedArgs };

export function createOutdated(deps?: LifecycleCliDeps) {
  const resolved: LifecycleCliDeps = deps ?? {
    name: "bapm",
    manifestFile: "bapm.yml",
    lockFile: "bapm.lock.yaml",
  };
  return {
    async run(options: { args?: string[]; cwd?: string }): Promise<LifecycleResult> {
      return runOutdatedCli(resolved, options);
    },
    formatHelp(): string {
      return formatOutdatedHelp(resolved);
    },
  };
}

export type OutdatedApi = ReturnType<typeof createOutdated>;
