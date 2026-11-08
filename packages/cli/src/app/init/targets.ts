import { createTargets } from "@/modules/Targets";
import { coreIntegration } from "../integrations/core.ts";

export const targets = createTargets({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  lockFile: coreIntegration.lockFile,
});
