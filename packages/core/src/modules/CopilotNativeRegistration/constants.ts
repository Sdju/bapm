import { APM_MODULES_DIR } from "@/modules/Resolver";
import { join } from "node:path";

/** Marketplace id / enable suffix aligned with APM Copilot projection. */
export const COPILOT_NATIVE_MARKETPLACE_ID = "apm";
export const COPILOT_NATIVE_ENABLE_SUFFIX = "@apm";

/** Repository-relative modules root used in settings + catalog paths. */
export const COPILOT_NATIVE_MODULES_PATH = APM_MODULES_DIR;

export const COPILOT_NATIVE_PLUGIN_DIR_REL = join(COPILOT_NATIVE_MODULES_PATH, ".github", "plugin");
export const COPILOT_NATIVE_MARKETPLACE_REL = join(
  COPILOT_NATIVE_PLUGIN_DIR_REL,
  "marketplace.json",
);
export const COPILOT_NATIVE_LEDGER_REL = join(
  COPILOT_NATIVE_PLUGIN_DIR_REL,
  "apm-registration.json",
);
export const COPILOT_NATIVE_SETTINGS_REL = join(".github", "copilot", "settings.local.json");

export const COPILOT_NATIVE_LEDGER_VERSION = 1;
