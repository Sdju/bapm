import { runInit, formatInitHelp, parseInitArgs } from "./services/runInit.ts";
import { discoverProject } from "./services/discover.ts";
import type { InitDeps, InitOptions, InitResult } from "./types/init.types.ts";
import type {
  DiscoveredHost,
  DiscoveryCounts,
  DiscoveryEntry,
  DiscoveryInventory,
  DiscoveryKind,
  ProjectDiscoveryReport,
} from "./types/discover.types.ts";

export type { InitDeps, InitOptions, InitResult };
export type {
  DiscoveredHost,
  DiscoveryCounts,
  DiscoveryEntry,
  DiscoveryInventory,
  DiscoveryKind,
  ProjectDiscoveryReport,
};
export { discoverProject, formatInitHelp, parseInitArgs };

export function createInit(deps: InitDeps) {
  return {
    async run(options: InitOptions = { args: [] }): Promise<InitResult> {
      return runInit(deps, options);
    },
    formatHelp(): string {
      return formatInitHelp(deps);
    },
  };
}

export type InitApi = ReturnType<typeof createInit>;
