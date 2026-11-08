import { createConfig } from "@/modules/Config";
import { coreIntegration } from "../integrations/core.ts";

export const config = createConfig({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  lockFile: coreIntegration.lockFile,
});
