import { createFind } from "@/modules/Find";
import { coreIntegration } from "../integrations/core.ts";

export const find = createFind({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  lockFile: coreIntegration.lockFile,
});
