import { createMcp } from "@/modules/Mcp";
import { coreIntegration } from "../integrations/core.ts";

export const mcp = createMcp({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  lockFile: coreIntegration.lockFile,
});
