import { createDoctor } from "@/modules/Doctor";
import { coreIntegration } from "../integrations/core.ts";

export const doctor = createDoctor({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  lockFile: coreIntegration.lockFile,
});
