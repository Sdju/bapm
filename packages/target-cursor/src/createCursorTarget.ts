import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AttributedPrimitive, AttributedPrimitiveSet, BapmTarget } from "bapm-target-api";

const DEFAULT_DEPLOY_ROOTS = [".agents/skills", ".cursor"] as const;

function primitivesList(set: AttributedPrimitiveSet): AttributedPrimitive[] {
  if (Array.isArray(set)) return set;
  if (set && typeof set === "object" && Array.isArray(set.primitives)) {
    return set.primitives;
  }
  return [];
}

/**
 * Create the minimal Cursor target.
 * Detects `.cursor/`; materializes skills under `.agents/skills/<name>/SKILL.md` (tg-003).
 */
export function createCursorTarget(options?: { id?: string; deployRoots?: string[] }): BapmTarget {
  const id = options?.id ?? "cursor";
  const deployRoots = [...(options?.deployRoots ?? DEFAULT_DEPLOY_ROOTS)];

  return {
    id,
    deployRoots,
    detect: ({ cwd }) => existsSync(join(cwd, ".cursor")),
    getDeployRoots: () => [...deployRoots],
    async materialize(primitives, ctx) {
      const cwd = resolve(ctx?.cwd ?? process.cwd());
      const skillsRoot = join(cwd, ".agents", "skills");
      if (!deployRoots.some((r) => r === ".agents/skills" || r.startsWith(".agents/skills"))) {
        throw new Error("cursor target missing .agents/skills deploy root");
      }
      mkdirSync(skillsRoot, { recursive: true });

      for (const p of primitivesList(primitives)) {
        if (!/skill/i.test(String(p.type ?? "skill"))) continue;
        const name = String(p.name || "unnamed").replace(/[/\\]/g, "-");
        const destDir = join(skillsRoot, name);
        const destFile = join(destDir, "SKILL.md");
        mkdirSync(destDir, { recursive: true });

        const src = p.path ? resolve(p.path) : undefined;
        if (src && existsSync(src)) {
          const skillMd = src.endsWith("SKILL.md") ? src : join(src, "SKILL.md");
          if (existsSync(skillMd)) {
            cpSync(skillMd, destFile);
            continue;
          }
          const content = typeof p.content === "string" ? p.content : readFileSync(src, "utf8");
          writeFileSync(destFile, content, "utf8");
          continue;
        }
        const content =
          typeof p.content === "string" ? p.content : `---\nname: ${name}\n---\n# ${name}\n`;
        writeFileSync(destFile, content, "utf8");
      }
    },
  };
}
