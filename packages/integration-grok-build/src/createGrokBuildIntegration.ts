/**
 * Create the Grok Build target.
 * Detect: project-root `.grok/` directory only (not lone `AGENTS.md`).
 * Materialize: skills → `.grok/skills/<name>/SKILL.md`,
 * instructions → `.grok/rules/<name>.md` (verbatim),
 * agents → `.grok/agents/<name>.md`,
 * commands → `.grok/commands/<name>.md` (Claude-subset frontmatter),
 * hooks/prompts → non-fatal skip diagnostics.
 * No `configureMcp` (APM N).
 * Compile: project-root `AGENTS.md` (agents compile family).
 */
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { BapmIntegration, CompileReport, MaterializeReport } from "@b-apm/integration-api";
import {
  SHARED_COMMAND_FRONTMATTER_KEYS,
  compilePrimitivesMarkdown,
  createMaterializeRun,
  filterFrontmatterKeys,
  materializeSkill,
  primitivesMaterialize,
  readPrimitiveContent,
  writeDeployedFile,
} from "@b-apm/integration-api";

const DEFAULT_DEPLOY_ROOTS = [".grok", "."] as const;

export function createGrokBuildIntegration(options?: {
  id?: string;
  deployRoots?: string[];
}): BapmIntegration {
  const id = options?.id ?? "grok-build";
  const deployRoots = [...(options?.deployRoots ?? DEFAULT_DEPLOY_ROOTS)];

  return {
    id,
    deployRoots,
    detect: ({ cwd }) => {
      const grokDir = join(cwd, ".grok");
      return existsSync(grokDir) && statSync(grokDir).isDirectory();
    },
    getDeployRoots: () => [...deployRoots],
    async compile(primitives, context): Promise<CompileReport> {
      return compilePrimitivesMarkdown(primitives, context, {
        title: "# AGENTS.md",
        defaultOutput: "AGENTS.md",
        requireBasename: "AGENTS.md",
        outsideCwdMessage: "Grok Build compile output must be a cwd-relative file path",
      });
    },
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const run = createMaterializeRun({
        primitives,
        ctx,
        defaultDeployRoots: deployRoots,
        targetId: id,
        requiredRoots: [".grok"],
        label: "grok-build",
      });
      const { cwd, roots, deployedFiles, diagnostics } = run;

      await primitivesMaterialize(primitives, {
        skill(p, { name }) {
          deployedFiles.push(
            ...materializeSkill({
              primitive: p,
              cwd,
              deployRoots: roots,
              destDir: join(".grok", "skills", name),
            }),
          );
        },
        instruction(p, { name }) {
          deployedFiles.push(
            writeDeployedFile({
              cwd,
              deployRoots: roots,
              destRel: join(".grok", "rules", `${name}.md`),
              content: readPrimitiveContent(p),
              primitive: { name: String(p.name), packageName: p.packageName },
            }),
          );
        },
        agent(p, { name }) {
          deployedFiles.push(
            writeDeployedFile({
              cwd,
              deployRoots: roots,
              destRel: join(".grok", "agents", `${name}.md`),
              content: readPrimitiveContent(p),
              primitive: { name: String(p.name), packageName: p.packageName },
            }),
          );
        },
        command(p, { name }) {
          const { content, droppedKeys } = filterFrontmatterKeys(
            readPrimitiveContent(p),
            SHARED_COMMAND_FRONTMATTER_KEYS,
          );
          deployedFiles.push(
            writeDeployedFile({
              cwd,
              deployRoots: roots,
              destRel: join(".grok", "commands", `${name}.md`),
              content,
              primitive: { name: String(p.name), packageName: p.packageName },
            }),
          );
          if (droppedKeys.length > 0) {
            diagnostics.push({
              code: "GROK_BUILD_COMMAND_FRONTMATTER_DROPPED",
              message: `Dropped non-preserved command frontmatter keys for "${p.name}": ${droppedKeys.join(", ")}`,
              primitive: String(p.name),
              droppedKeys,
            });
          }
        },
        hook(p) {
          diagnostics.push({
            code: "GROK_BUILD_HOOKS_UNSUPPORTED",
            message: `Grok Build does not support hooks; skipping hook "${p.name}"`,
            primitive: String(p.name),
            kind: "hook",
          });
        },
        unknown(p, { type }) {
          if (/prompt/i.test(type)) {
            diagnostics.push({
              code: "GROK_BUILD_PROMPTS_UNSUPPORTED",
              message: `Grok Build does not support prompts; skipping prompt "${p.name}"`,
              primitive: String(p.name),
              kind: "prompt",
            });
          }
        },
      });

      return run.report();
    },
  };
}
