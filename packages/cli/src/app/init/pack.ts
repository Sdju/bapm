import {
  checkReleaseTag,
  checkVersionAlignment,
  detectAuthoringConfigSource,
  loadMarketplaceAuthoringConfig,
  runPack,
  versionAlignmentErrorMessages,
} from "@b-apm/core";
import { createPack } from "@/modules/Pack";
import { coreIntegration } from "../integrations/core.ts";
import { loadCliMarketplaceOutputsForPack } from "../integrations/marketplaceOutputs.ts";

export const pack = createPack({
  name: coreIntegration.name,
  runPack: async (options) => {
    const marketplaceOutputs = await loadCliMarketplaceOutputsForPack({
      cwd: options.cwd,
      marketplace: options.marketplace,
    });
    return runPack({ ...options, marketplaceOutputs });
  },
  checkReleaseTag: (options) => checkReleaseTag(options),
  checkVersionAlignment: (options) =>
    checkVersionAlignment({
      config: options.config as Parameters<typeof checkVersionAlignment>[0]["config"],
      cwd: options.cwd,
      projectRoot: options.projectRoot,
      root: options.root,
    }),
  loadMarketplaceAuthoringConfig: (options) => loadMarketplaceAuthoringConfig(options),
  detectAuthoringConfigSource: (options) => detectAuthoringConfigSource(options),
  versionAlignmentErrorMessages: (report) =>
    versionAlignmentErrorMessages({
      strategy: "lockstep",
      expected: null,
      ok: false,
      packages: report.packages,
    }),
});
