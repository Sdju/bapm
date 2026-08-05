import { createPolicy } from "@/modules/Policy";
import { coreIntegration } from "../integrations/core.ts";

export const policy = createPolicy({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  lockFile: coreIntegration.lockFile,
});
