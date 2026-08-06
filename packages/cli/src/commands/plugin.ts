import type { PluginApi } from "@/modules/Plugin";

export async function pluginCommand(argv: string[], plugin: PluginApi): Promise<number> {
  const result = await plugin.run({ args: argv, cwd: process.cwd() });
  return result.ok ? 0 : 1;
}
