import { createView } from "@/modules/View";
import { coreIntegration } from "../integrations/core.ts";

export const view = createView({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  lockFile: coreIntegration.lockFile,
});
