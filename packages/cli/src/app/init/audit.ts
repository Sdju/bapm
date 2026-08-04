import { createAudit } from "@/modules/Audit";
import { coreIntegration } from "../integrations/core.ts";

export const audit = createAudit({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  lockFile: coreIntegration.lockFile,
});
