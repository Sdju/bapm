import { createDeps } from "@/modules/Deps";
import { coreIntegration } from "../integrations/core.ts";

export const deps = createDeps({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  lockFile: coreIntegration.lockFile,
});
