/**
 * Copilot native Agent Plugins registration (project scope).
 *
 * Builds owned catalog/ledger under `apm_modules/.github/plugin/`, merges
 * `.github/copilot/settings.local.json`, and supports install/uninstall/prune sync.
 * Does not invoke a Copilot binary.
 */

export type { CopilotNativeRegistrationErrorCode } from "./errors.ts";
export { CopilotNativeRegistrationError } from "./errors.ts";

export type {
  AdmittedCopilotNativePlugin,
  CopilotNativeLedger,
  CopilotNativeLedgerPlugin,
  RebuildCopilotNativeRegistrationOptions,
  SyncCopilotNativeRegistrationOptions,
} from "./types.ts";

export {
  COPILOT_NATIVE_ENABLE_SUFFIX,
  COPILOT_NATIVE_LEDGER_REL,
  COPILOT_NATIVE_LEDGER_VERSION,
  COPILOT_NATIVE_MARKETPLACE_ID,
  COPILOT_NATIVE_MARKETPLACE_REL,
  COPILOT_NATIVE_MODULES_PATH,
  COPILOT_NATIVE_PLUGIN_DIR_REL,
  COPILOT_NATIVE_SETTINGS_REL,
} from "./constants.ts";

export {
  admitCopilotNativePlugins,
  portablePluginRoot,
  resolvePluginNameCollisions,
} from "./admit.ts";

export {
  clearCopilotNativeCatalogArtifacts,
  readCopilotNativeLedger,
  writeCopilotNativeCatalog,
  writeCopilotNativeLedger,
} from "./catalog.ts";

export {
  mergeCopilotNativeSettings,
  retireCopilotNativeSettings,
  assertCopilotNativeSettingsWritable,
} from "./settings.ts";

export {
  rebuildCopilotNativeRegistration,
  rebuildCopilotNativeRegistrationFromNodes,
  syncCopilotNativeRegistrationFromLock,
} from "./rebuild.ts";

export { filterPrimitivesForCopilotNative } from "./filter.ts";
