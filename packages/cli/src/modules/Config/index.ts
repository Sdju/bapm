import { formatConfigHelp, runConfigCli } from "./services/runConfig.ts";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";
import type { UserConfigStoreOptions } from "./store.ts";

export type { LifecycleCliDeps, LifecycleResult };
export type { ConfigCliDeps, ConfigOptions, ParsedConfigArgs } from "./services/runConfig.ts";
export type { UserConfigDocument, UserConfigStoreOptions } from "./store.ts";

export { formatConfigHelp, parseConfigArgs, runConfigCli } from "./services/runConfig.ts";
export {
  getConfigValue,
  loadUserConfig,
  readConfiguredTarget,
  resolveConfigRoot,
  setConfigValue,
  unsetConfigValue,
  userConfigPath,
  writeUserConfig,
} from "./store.ts";

export function createConfig(deps?: LifecycleCliDeps & UserConfigStoreOptions) {
  const resolved = {
    name: deps?.name ?? "bapm",
    manifestFile: deps?.manifestFile ?? "bapm.yml",
    lockFile: deps?.lockFile ?? "bapm.lock.yaml",
    ...(deps?.configRoot ? { configRoot: deps.configRoot } : {}),
    ...(deps?.configDir ? { configDir: deps.configDir } : {}),
  };
  return {
    async run(options: { args?: string[]; cwd?: string }): Promise<LifecycleResult> {
      return runConfigCli(resolved, options);
    },
    formatHelp(): string {
      return formatConfigHelp(resolved);
    },
  };
}

export type ConfigApi = ReturnType<typeof createConfig>;
