import { createUninstall } from "@/modules/Uninstall";
import { coreIntegration } from "../integrations/core.ts";

export const uninstall = createUninstall({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  lockFile: coreIntegration.lockFile,
});
