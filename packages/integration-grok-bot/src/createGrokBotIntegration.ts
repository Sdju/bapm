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
import { join, resolve } from "node:path";
import type {
  AttributedPrimitive,
  BapmIntegration,
  MaterializeReport,
} from "@b-apm/integration-api";
import { materializeSkill, primitivesMaterialize } from "@b-apm/integration-api";

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
      const cwd = resolve(ctx?.cwd ?? process.cwd());
      const roots = ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots;
      if (!roots.some((r) => r === "agent-data" || r.startsWith("agent-data/"))) {
        throw new Error("grok-bot target missing agent-data deploy root");
      }

      const deployedFiles: MaterializeReport["deployedFiles"] = [];
      const diagnostics: NonNullable<MaterializeReport["diagnostics"]> = [];

      const skipNonSkill = (p: AttributedPrimitive, kind: string) => {
        diagnostics.push({
          code: "GROK_BOT_PRIMITIVE_UNSUPPORTED",
          message: `grok-bot supports skills only; skipped ${kind} primitive: "${p.name}"`,
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
              destDir: join("agent-data", "workflows", name),
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
