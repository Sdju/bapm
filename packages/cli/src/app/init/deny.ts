import { createDeny } from "@/modules/Deny";
import { runMcpReconfigure } from "@/modules/Install";
import { coreIntegration } from "../integrations/core.ts";

export const deny = createDeny({
  name: coreIntegration.name,
  manifestFile: coreIntegration.manifestFile,
  applyDenied: (options) => runMcpReconfigure({ cwd: options.cwd }),
});
