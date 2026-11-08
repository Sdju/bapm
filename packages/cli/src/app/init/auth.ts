import { createAuth } from "@/modules/Auth";
import { coreIntegration } from "../integrations/core.ts";

export const auth = createAuth({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  lockFile: coreIntegration.lockFile,
});
