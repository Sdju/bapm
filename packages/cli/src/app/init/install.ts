import { createInstall } from "@/modules/Install";
import { coreIntegration } from "../integrations/core.ts";

export const install = createInstall({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  lockFile: coreIntegration.lockFile,
});
