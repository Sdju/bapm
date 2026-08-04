import { runPackCli, formatPackHelp, parsePackArgs } from "./services/runPack.ts";
import type { PackDeps, PackOptions, PackResult } from "./types/pack.types.ts";

export type { PackDeps, PackOptions, PackResult };
export { formatPackHelp, parsePackArgs };

export function createPack(deps: PackDeps) {
  return {
    async run(options: PackOptions = { args: [] }): Promise<PackResult> {
      return runPackCli(deps, options);
    },
    formatHelp(): string {
      return formatPackHelp(deps);
    },
  };
}

export type PackApi = ReturnType<typeof createPack>;
