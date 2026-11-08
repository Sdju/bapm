import { createPreview } from "@/modules/Run";
import { coreIntegration } from "../integrations/core.ts";

export const preview = createPreview({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  lockFile: coreIntegration.lockFile,
});
