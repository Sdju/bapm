import { createPrune } from "@/modules/Prune";
import { coreIntegration } from "../integrations/core.ts";

export const prune = createPrune({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  lockFile: coreIntegration.lockFile,
});
