import { existsSync, mkdirSync } from "node:fs";
import {
  createMinimalManifest,
  validatePluginName,
  validateProjectName,
  writePluginJson,
  writeProducerManifest,
} from "@bapm/core";
import { createPlugin } from "@/modules/Plugin";
import { coreIntegration } from "../integrations/core.ts";

export const plugin = createPlugin({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  validatePluginName,
  validateProjectName,
  createMinimalManifest: (options) => createMinimalManifest(options),
  writeProducerManifest: (document, options) => writeProducerManifest(document, options),
  writePluginJson: (options) => writePluginJson(options),
  existsSync,
  mkdirSync,
});
