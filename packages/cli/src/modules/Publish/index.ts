import { formatPublishHelp, runPublishCli } from "./services/runPublish.ts";
import type { PublishDeps, PublishOptions, PublishResult } from "./types/publish.types.ts";

export type { PublishDeps, PublishOptions, PublishResult };
export { formatPublishHelp };

export function createPublish(deps: PublishDeps) {
  return {
    async run(options: PublishOptions): Promise<PublishResult> {
      return runPublishCli(deps, options);
    },
  };
}

export type PublishApi = ReturnType<typeof createPublish>;
