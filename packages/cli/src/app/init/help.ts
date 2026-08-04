import { createHelp } from "@/modules/Help";
import { coreIntegration } from "../integrations/core.ts";

export const help = createHelp({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
});
