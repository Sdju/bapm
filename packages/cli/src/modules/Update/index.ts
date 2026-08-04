import { formatUpdateHelp, parseUpdateArgs, runUpdateCli } from "./services/runUpdate.ts";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type { LifecycleCliDeps, LifecycleResult };
export { formatUpdateHelp, parseUpdateArgs };

export function createUpdate(deps?: LifecycleCliDeps) {
  const resolved: LifecycleCliDeps = deps ?? {
    name: "bapm",
    manifestFile: "bapm.yml",
    lockFile: "bapm.lock.yaml",
  };
  return {
    async run(options: { args?: string[]; cwd?: string }): Promise<LifecycleResult> {
      return runUpdateCli(resolved, options);
    },
    formatHelp(): string {
      return formatUpdateHelp(resolved);
    },
  };
}

export type UpdateApi = ReturnType<typeof createUpdate>;
