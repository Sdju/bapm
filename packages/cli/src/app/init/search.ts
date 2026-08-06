import { createSearch } from "@/modules/Search";
import { coreIntegration } from "../integrations/core.ts";

export const search = createSearch({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  lockFile: coreIntegration.lockFile,
});
