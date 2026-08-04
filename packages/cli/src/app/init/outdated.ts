import { createOutdated } from "@/modules/Outdated";
import { coreIntegration } from "../integrations/core.ts";

export const outdated = createOutdated({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  lockFile: coreIntegration.lockFile,
});
