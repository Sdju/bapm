import { formatCacheHelp, parseCacheArgs, runCacheCli } from "./services/runCache.ts";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type { LifecycleCliDeps, LifecycleResult };
export { formatCacheHelp, parseCacheArgs };

export function createCache(deps?: LifecycleCliDeps) {
  const resolved: LifecycleCliDeps = deps ?? {
    name: "bapm",
    manifestFile: "bapm.yml",
    lockFile: "bapm.lock.yaml",
  };
  return {
    async run(options: { args?: string[]; cwd?: string }): Promise<LifecycleResult> {
      return runCacheCli(resolved, options);
    },
    formatHelp(): string {
      return formatCacheHelp(resolved);
    },
  };
}

export type CacheApi = ReturnType<typeof createCache>;
