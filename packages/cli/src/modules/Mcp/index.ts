import { formatMcpHelp, parseMcpArgs, runMcpCli } from "./services/runMcp.ts";
import type { LifecycleCliDeps, LifecycleResult } from "@/common/types/lifecycle.types.ts";

export type { LifecycleCliDeps, LifecycleResult };
export type { McpCliDeps, McpOptions, McpSub, ParsedMcpArgs } from "./services/runMcp.ts";
export { formatMcpHelp, parseMcpArgs };

export function createMcp(deps?: LifecycleCliDeps) {
  const resolved: LifecycleCliDeps = deps ?? {
    name: "bapm",
    manifestFile: "bapm.yml",
    lockFile: "bapm.lock.yaml",
  };
  return {
    async run(options: { args?: string[]; cwd?: string }): Promise<LifecycleResult> {
      return runMcpCli(resolved, options);
    },
    formatHelp(): string {
      return formatMcpHelp(resolved);
    },
  };
}

export type McpApi = ReturnType<typeof createMcp>;
