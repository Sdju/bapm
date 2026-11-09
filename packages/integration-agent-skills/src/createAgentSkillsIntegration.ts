/**
 * Create the agent-skills (cross-client shared skills) target.
 * Detect: always false — never auto-detect from `.agents/` (shared by other hosts).
 * Materialize: skills → `.agents/skills/<name>/SKILL.md` only; other kinds skip.
 * No MCP, hooks, or compile.
 */
import type { BapmIntegration, MaterializeReport } from "@b-apm/integration-api";
import {
  createMaterializeRun,
  primitivesMaterialize,
  skillsOnlyHandlers,
} from "@b-apm/integration-api";

const DEFAULT_DEPLOY_ROOTS = [".agents"] as const;

export function createAgentSkillsIntegration(options?: {
  id?: string;
  deployRoots?: string[];
}): BapmIntegration {
  const id = options?.id ?? "agent-skills";
  const deployRoots = [...(options?.deployRoots ?? DEFAULT_DEPLOY_ROOTS)];

  return {
    id,
    deployRoots,
    detect: () => false,
    // Global materialize receives the user home as `ctx.cwd`; `.agents/skills`
    // then resolves to the shared user-level skills directory.
    supportsGlobalFiles: true,
    getDeployRoots: () => [...deployRoots],
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const run = createMaterializeRun({
        primitives,
        ctx,
        defaultDeployRoots: deployRoots,
        targetId: id,
        requiredRoots: [".agents"],
        label: "agent-skills",
      });
      const { cwd, roots, deployedFiles, diagnostics } = run;

      await primitivesMaterialize(
        primitives,
        skillsOnlyHandlers({
          cwd,
          deployRoots: roots,
          destDir: ".agents/skills",
          code: "AGENT_SKILLS_PRIMITIVE_UNSUPPORTED",
          label: "agent-skills",
          deployedFiles,
          diagnostics,
        }),
      );

      return run.report();
    },
  };
}
