import { createRun } from "@/modules/Run";
import { coreIntegration } from "../integrations/core.ts";

export const run = createRun({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  lockFile: coreIntegration.lockFile,
});
