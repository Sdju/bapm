import { checkReleaseTag, runPack } from "@bapm/core";
import { createPack } from "@/modules/Pack";
import { coreIntegration } from "../integrations/core.ts";

export const pack = createPack({
  name: coreIntegration.name,
  runPack: (options) => runPack(options),
  checkReleaseTag: (options) => checkReleaseTag(options),
});
