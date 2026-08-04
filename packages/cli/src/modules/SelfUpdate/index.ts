import { formatSelfUpdateHelp, runSelfUpdateCli } from "./services/runSelfUpdate.ts";
import type {
  SelfUpdateDeps,
  SelfUpdateOptions,
  SelfUpdateResult,
} from "./types/selfUpdate.types.ts";

export type { SelfUpdateDeps, SelfUpdateOptions, SelfUpdateResult };
export { formatSelfUpdateHelp };

export function createSelfUpdate(deps: SelfUpdateDeps) {
  return {
    async run(options: SelfUpdateOptions = {}): Promise<SelfUpdateResult> {
      return runSelfUpdateCli(deps, options);
    },
  };
}

export type SelfUpdateApi = ReturnType<typeof createSelfUpdate>;
