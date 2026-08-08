/**
 * RED stub — intentionally wrong so acceptance fails until apply implements the host.
 */
import type { BapmIntegration } from "@bapm/integration-api";

export function createAgentSkillsIntegration(_options?: {
  id?: string;
  deployRoots?: string[];
}): BapmIntegration {
  return {
    id: "not-agent-skills",
    deployRoots: [".wrong"],
    detect: () => true,
    materialize: async () => ({ deployedFiles: [] }),
    configureMcp: async () => ({
      targetId: "not-agent-skills",
      configPath: ".wrong/mcp.json",
      servers: [],
    }),
    compile: async () => ({
      path: "WRONG.md",
      content: "",
      wrote: false,
    }),
  };
}
