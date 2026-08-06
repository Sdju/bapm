import {
  formatSearchHelp,
  parseSearchArgs,
  runSearchCli,
} from "./services/runSearch.ts";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type { LifecycleCliDeps, LifecycleResult };
export { formatSearchHelp, parseSearchArgs };

export function createSearch(deps?: LifecycleCliDeps) {
  const resolved: LifecycleCliDeps = deps ?? {
    name: "bapm",
    manifestFile: "bapm.yml",
    lockFile: "bapm.lock.yaml",
  };
  return {
    async run(options: { args?: string[]; cwd?: string }): Promise<LifecycleResult> {
      return runSearchCli(resolved, options);
    },
    formatHelp(): string {
      return formatSearchHelp(resolved);
    },
  };
}

export type SearchApi = ReturnType<typeof createSearch>;
