import {
  formatMarketplaceHelp,
  parseMarketplaceArgs,
  runMarketplaceCli,
} from "./services/runMarketplace.ts";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type { LifecycleCliDeps, LifecycleResult };
export { formatMarketplaceHelp, parseMarketplaceArgs };

export function createMarketplace(deps?: LifecycleCliDeps) {
  const resolved: LifecycleCliDeps = deps ?? {
    name: "bapm",
    manifestFile: "bapm.yml",
    lockFile: "bapm.lock.yaml",
  };
  return {
    async run(options: { args?: string[]; cwd?: string }): Promise<LifecycleResult> {
      return runMarketplaceCli(resolved, options);
    },
    formatHelp(): string {
      return formatMarketplaceHelp(resolved);
    },
  };
}

export type MarketplaceApi = ReturnType<typeof createMarketplace>;
