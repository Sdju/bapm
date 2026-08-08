import type { BapmIntegration } from "@bapm/integration-api";

/**
 * Stub for acceptance RED — replaced in apply with full Gemini runtime.
 */
export function createGeminiIntegration(options?: {
  id?: string;
  deployRoots?: string[];
}): BapmIntegration {
  const id = options?.id ?? "stub-gemini";
  const deployRoots = [...(options?.deployRoots ?? [".gemini"])];
  return {
    id,
    deployRoots,
    detect: async () => false,
    getDeployRoots: () => [...deployRoots],
    async materialize() {
      return { targetId: id, deployedFiles: [] };
    },
  };
}
