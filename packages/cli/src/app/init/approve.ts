import { createApprove } from "@/modules/Approve";
import { coreIntegration } from "../integrations/core.ts";

export const approve = createApprove({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
});
