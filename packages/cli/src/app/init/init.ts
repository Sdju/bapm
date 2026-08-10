import { existsSync } from "node:fs";
import { join } from "node:path";
import { createMinimalManifest, writeProducerManifest } from "@b-apm/core";
import { createInit } from "@/modules/Init";
import { coreIntegration } from "../integrations/core.ts";

export const init = createInit({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  createMinimalManifest: (options) => createMinimalManifest(options),
  writeProducerManifest: (document, options) => writeProducerManifest(document, options),
  existsSync,
  detectCursor: (cwd) => existsSync(join(cwd, ".cursor")),
});
