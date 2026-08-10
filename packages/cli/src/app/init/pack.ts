import { checkReleaseTag, runPack } from "@b-apm/core";
import { createPack } from "@/modules/Pack";
import { coreIntegration } from "../integrations/core.ts";
import { loadCliMarketplaceOutputsForPack } from "../integrations/marketplaceOutputs.ts";

export const pack = createPack({
  name: coreIntegration.name,
  runPack: async (options) => {
    const marketplaceOutputs = await loadCliMarketplaceOutputsForPack({
      cwd: options.cwd,
      marketplace: options.marketplace,
    });
    return runPack({ ...options, marketplaceOutputs });
  },
  checkReleaseTag: (options) => checkReleaseTag(options),
});
