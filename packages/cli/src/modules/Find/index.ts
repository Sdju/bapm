import { formatFindHelp, parseFindArgs, runFindCli } from "./services/runFind.ts";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type { LifecycleCliDeps, LifecycleResult };
export { formatFindHelp, parseFindArgs };

export function createFind(deps?: LifecycleCliDeps) {
  const resolved: LifecycleCliDeps = deps ?? {
    name: "bapm",
    manifestFile: "bapm.yml",
    lockFile: "bapm.lock.yaml",
  };
  return {
    async run(options: { args?: string[]; cwd?: string }): Promise<LifecycleResult> {
      return runFindCli(resolved, options);
    },
    formatHelp(): string {
      return formatFindHelp(resolved);
    },
  };
}

export type FindApi = ReturnType<typeof createFind>;
