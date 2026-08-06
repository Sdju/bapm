import { createDeny } from "@/modules/Deny";
import { coreIntegration } from "../integrations/core.ts";

export const deny = createDeny({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
});
