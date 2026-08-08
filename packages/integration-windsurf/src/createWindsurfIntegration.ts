/**
 * RED stub: package surface exists for typecheck; behavior intentionally incomplete.
 */
import type { BapmIntegration } from "@bapm/integration-api";

export function createWindsurfIntegration(_options?: {
  id?: string;
  deployRoots?: string[];
}): BapmIntegration {
  return {
    id: "windsurf-stub",
    deployRoots: [],
    detect: () => false,
    getDeployRoots: () => [],
    async materialize() {
      return { deployedFiles: [] };
    },
  };
}

export const createIntegration = createWindsurfIntegration;
