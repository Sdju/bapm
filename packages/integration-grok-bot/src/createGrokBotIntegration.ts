/**
 * Create the Grok Bot target.
 * Detect: always false — Grok Bot is explicit-only in APM
 * (`KNOWN_TARGETS["grok-bot"]`, `detect_by_dir=False`); `agent-data/` is not a
 * shared host marker, so presence of the directory MUST NOT auto-activate.
 * Materialize: skills → `agent-data/workflows/<name>/SKILL.md` only; other
 * kinds skip with a non-fatal diagnostic.
 * No MCP and no compile (APM grok-bot capability has neither).
 * bapm is project-scope only, so only the project `agent-data/` root applies.
 */
import type { BapmIntegration, MaterializeReport } from "@b-apm/integration-api";
import {
  createMaterializeRun,
  primitivesMaterialize,
  skillsOnlyHandlers,
} from "@b-apm/integration-api";

const DEFAULT_DEPLOY_ROOTS = ["agent-data"] as const;

export function createGrokBotIntegration(options?: {
  id?: string;
  deployRoots?: string[];
}): BapmIntegration {
  const id = options?.id ?? "grok-bot";
  const deployRoots = [...(options?.deployRoots ?? DEFAULT_DEPLOY_ROOTS)];

  return {
    id,
    deployRoots,
    detect: () => false,
    getDeployRoots: () => [...deployRoots],
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const run = createMaterializeRun({
        primitives,
        ctx,
        defaultDeployRoots: deployRoots,
        targetId: id,
        requiredRoots: ["agent-data"],
        label: "grok-bot",
      });
      const { cwd, roots, deployedFiles, diagnostics } = run;

      await primitivesMaterialize(
        primitives,
        skillsOnlyHandlers({
          cwd,
          deployRoots: roots,
          destDir: "agent-data/workflows",
          code: "GROK_BOT_PRIMITIVE_UNSUPPORTED",
          label: "grok-bot",
          deployedFiles,
          diagnostics,
        }),
      );

      return run.report();
    },
  };
}
