import { createRuntime } from "@/modules/Runtime";
import { coreIntegration } from "../integrations/core.ts";

export const runtime = createRuntime({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  lockFile: coreIntegration.lockFile,
});
