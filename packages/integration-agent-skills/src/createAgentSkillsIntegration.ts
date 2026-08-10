/**
 * Create the agent-skills (cross-client shared skills) target.
 * Detect: always false — never auto-detect from `.agents/` (shared by other hosts).
 * Materialize: skills → `.agents/skills/<name>/SKILL.md` only; other kinds skip.
 * No MCP, hooks, or compile.
 */
import { resolve, join } from "node:path";
import type {
  AttributedPrimitive,
  BapmIntegration,
  MaterializeReport,
} from "@b-apm/integration-api";
import { materializeSkill, primitivesMaterialize } from "@b-apm/integration-api";

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
    getDeployRoots: () => [...deployRoots],
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const cwd = resolve(ctx?.cwd ?? process.cwd());
      const roots = ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots;
      if (!roots.some((r) => r === ".agents" || r.startsWith(".agents"))) {
        throw new Error("agent-skills target missing .agents deploy root");
      }

      const deployedFiles: MaterializeReport["deployedFiles"] = [];
      const diagnostics: NonNullable<MaterializeReport["diagnostics"]> = [];

      const skipNonSkill = (p: AttributedPrimitive, kind: string) => {
        diagnostics.push({
          code: "AGENT_SKILLS_PRIMITIVE_UNSUPPORTED",
          message: `agent-skills supports skills only; skipped ${kind} primitive: "${p.name}"`,
          primitive: String(p.name),
          kind,
        });
      };

      await primitivesMaterialize(primitives, {
        skill(p, { name }) {
          deployedFiles.push(
            ...materializeSkill({
              primitive: p,
              cwd,
              deployRoots: roots,
              destDir: join(".agents", "skills", name),
            }),
          );
        },
        instruction(p) {
          skipNonSkill(p, "instruction");
        },
        agent(p) {
          skipNonSkill(p, "agent");
        },
        command(p) {
          skipNonSkill(p, "command");
        },
        hook(p) {
          skipNonSkill(p, "hook");
        },
        unknown(p, { type }) {
          skipNonSkill(p, type || "unknown");
        },
      });

      return {
        targetId: id,
        deployedFiles,
        ...(diagnostics.length > 0 ? { diagnostics } : {}),
      };
    },
  };
}
