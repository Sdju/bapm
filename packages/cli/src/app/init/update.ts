import { createUpdate } from "@/modules/Update";
import { coreIntegration } from "../integrations/core.ts";

export const update = createUpdate({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  lockFile: coreIntegration.lockFile,
});
