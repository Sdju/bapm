import { formatViewHelp, parseViewArgs, runViewCli } from "./services/runView.ts";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type { LifecycleCliDeps, LifecycleResult };
export { formatViewHelp, parseViewArgs };

export function createView(deps?: LifecycleCliDeps) {
  const resolved: LifecycleCliDeps = deps ?? {
    name: "bapm",
    manifestFile: "bapm.yml",
    lockFile: "bapm.lock.yaml",
  };
  return {
    async run(options: { args?: string[]; cwd?: string }): Promise<LifecycleResult> {
      return runViewCli(resolved, options);
    },
    formatHelp(): string {
      return formatViewHelp(resolved);
    },
  };
}

export type ViewApi = ReturnType<typeof createView>;
