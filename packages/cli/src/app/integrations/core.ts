import { BAPM_LOCK_FILE, BAPM_MANIFEST_FILE, BAPM_NAME, getVersion } from "@b-apm/core";

export const coreIntegration = {
  name: BAPM_NAME,
  manifestFile: BAPM_MANIFEST_FILE,
  lockFile: BAPM_LOCK_FILE,
  getVersion,
} as const;
