import {
  runPlugin,
  formatPluginHelp,
  formatPluginInitHelp,
  parsePluginArgs,
} from "./services/runPlugin.ts";
import type { PluginDeps, PluginOptions, PluginResult } from "./types/plugin.types.ts";

export type { PluginDeps, PluginOptions, PluginResult };
export { formatPluginHelp, formatPluginInitHelp, parsePluginArgs, runPlugin };

export function createPlugin(deps: PluginDeps) {
  return {
    async run(options: PluginOptions = { args: [] }): Promise<PluginResult> {
      return runPlugin(deps, options);
    },
    formatHelp(): string {
      return formatPluginHelp(deps);
    },
  };
}

export type PluginApi = ReturnType<typeof createPlugin>;
