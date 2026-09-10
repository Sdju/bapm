import { existsSync } from "node:fs";
import { join } from "node:path";

/** APM `find_plugin_json` location order (first existing wins). */
export const PLUGIN_JSON_CANDIDATES = [
  "plugin.json",
  ".github/plugin/plugin.json",
  ".claude-plugin/plugin.json",
  ".cursor-plugin/plugin.json",
] as const;

export function findPluginJson(packageRoot: string): string | undefined {
  for (const rel of PLUGIN_JSON_CANDIDATES) {
    const candidate = join(packageRoot, rel);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}
