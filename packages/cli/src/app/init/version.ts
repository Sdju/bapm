import { createVersion } from "@/modules/Version";
import { coreIntegration } from "../integrations/core.ts";

export const version = createVersion({
  name: coreIntegration.name,
  getVersion: coreIntegration.getVersion,
});
