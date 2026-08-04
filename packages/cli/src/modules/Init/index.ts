import { runInit, formatInitHelp, parseInitArgs } from "./services/runInit.ts";
import type { InitDeps, InitOptions, InitResult } from "./types/init.types.ts";

export type { InitDeps, InitOptions, InitResult };
export { formatInitHelp, parseInitArgs };

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
