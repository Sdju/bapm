import { checkSelfUpdate } from "@b-apm/core";
import { createSelfUpdate } from "@/modules/SelfUpdate";
import { coreIntegration } from "../integrations/core.ts";

export const selfUpdate = createSelfUpdate({
  name: coreIntegration.name,
  getVersion: coreIntegration.getVersion,
  checkSelfUpdate: (options) => checkSelfUpdate(options),
});
