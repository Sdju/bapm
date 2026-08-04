import { createCache } from "@/modules/Cache";
import { coreIntegration } from "../integrations/core.ts";

export const cache = createCache({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  lockFile: coreIntegration.lockFile,
});
