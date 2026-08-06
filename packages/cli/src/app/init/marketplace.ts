import { createMarketplace } from "@/modules/Marketplace";
import { coreIntegration } from "../integrations/core.ts";

export const marketplace = createMarketplace({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  lockFile: coreIntegration.lockFile,
});
