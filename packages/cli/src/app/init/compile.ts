import { createCompile } from "@/modules/Compile";
import { coreIntegration } from "../integrations/core.ts";
import { createCliTargetRegistry } from "../integrations/targets.ts";

export const compile = createCompile(
  {
    name: coreIntegration.name,
    manifestFile: coreIntegration.manifestFile,
    lockFile: coreIntegration.lockFile,
  },
  createCliTargetRegistry(),
);
