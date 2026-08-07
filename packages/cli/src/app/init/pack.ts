import { checkReleaseTag, runPack } from "@bapm/core";
import { createPack } from "@/modules/Pack";
import { coreIntegration } from "../integrations/core.ts";
import { createCliMarketplaceOutputRegistry } from "../integrations/marketplaceOutputs.ts";

export const pack = createPack({
  name: coreIntegration.name,
  runPack: (options) =>
    runPack({ ...options, marketplaceOutputs: createCliMarketplaceOutputRegistry() }),
  checkReleaseTag: (options) => checkReleaseTag(options),
});
