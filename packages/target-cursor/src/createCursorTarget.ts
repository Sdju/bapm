import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import type {
  AttributedPrimitive,
  AttributedPrimitiveSet,
  BapmTarget,
  MaterializeReport,
} from "bapm-target-api";

const DEFAULT_DEPLOY_ROOTS = [".agents/skills", ".cursor"] as const;

function primitivesList(set: AttributedPrimitiveSet): AttributedPrimitive[] {
  if (Array.isArray(set)) return set;
  if (set && typeof set === "object" && Array.isArray(set.primitives)) {
    return set.primitives;
  }
  return [];
}

function sanitizeName(name: string): string {
  return String(name || "unnamed").replace(/[/\\]/g, "-");
}

function isUnderRoot(cwd: string, absPath: string, rootRel: string): boolean {
  const rootAbs = resolve(cwd, rootRel);
  const rel = relative(rootAbs, absPath);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(`..${sep}`));
}

function assertUnderDeployRoots(cwd: string, absPath: string, deployRoots: string[]): void {
  if (!deployRoots.some((r) => isUnderRoot(cwd, absPath, r))) {
    throw new Error(`cursor materialize refuses path outside deploy roots: ${absPath}`);
  }
}

function readPrimitiveContent(p: AttributedPrimitive, preferredFile?: string): string {
  if (typeof p.content === "string") return p.content;
  const src = p.path ? resolve(p.path) : undefined;
  if (src && existsSync(src)) {
    if (preferredFile) {
      const nested = src.endsWith(preferredFile) ? src : join(src, preferredFile);
      if (existsSync(nested) && statSync(nested).isFile()) {
        return readFileSync(nested, "utf8");
      }
    }
    if (statSync(src).isFile()) return readFileSync(src, "utf8");
  }
  const name = sanitizeName(String(p.name));
  return `---\nname: ${name}\n---\n# ${name}\n`;
}

function toPosixRel(cwd: string, absPath: string): string {
  return relative(cwd, absPath).split(sep).join("/");
}

/**
 * Create the Cursor target.
 * Detect: `.cursor/` directory **or** legacy `.cursorrules` file.
 * Materialize: skills → `.agents/skills/<name>/SKILL.md`,
 * instructions → `.cursor/rules/<name>.mdc`,
 * agents → `.cursor/agents/<name>.md`.
 * Never writes `.cursor/mcp.json`.
 */
export function createCursorTarget(options?: { id?: string; deployRoots?: string[] }): BapmTarget {
  const id = options?.id ?? "cursor";
  const deployRoots = [...(options?.deployRoots ?? DEFAULT_DEPLOY_ROOTS)];

  return {
    id,
    deployRoots,
    detect: ({ cwd }) => {
      const cursorDir = join(cwd, ".cursor");
      if (existsSync(cursorDir) && statSync(cursorDir).isDirectory()) return true;
      const legacy = join(cwd, ".cursorrules");
      return existsSync(legacy) && statSync(legacy).isFile();
    },
    getDeployRoots: () => [...deployRoots],
    async materialize(primitives, ctx): Promise<MaterializeReport> {
      const cwd = resolve(ctx?.cwd ?? process.cwd());
      const roots = ctx?.deployRoots?.length ? [...ctx.deployRoots] : deployRoots;
      if (!roots.some((r) => r === ".agents/skills" || r.startsWith(".agents/skills"))) {
        throw new Error("cursor target missing .agents/skills deploy root");
      }
      if (!roots.some((r) => r === ".cursor" || r.startsWith(".cursor"))) {
        throw new Error("cursor target missing .cursor deploy root");
      }

      const deployedFiles: MaterializeReport["deployedFiles"] = [];

      for (const p of primitivesList(primitives)) {
        const type = String(p.type ?? "skill").toLowerCase();
        const name = sanitizeName(String(p.name));

        if (/skill/.test(type)) {
          const destDir = join(cwd, ".agents", "skills", name);
          const destFile = join(destDir, "SKILL.md");
          assertUnderDeployRoots(cwd, destFile, roots);
          mkdirSync(destDir, { recursive: true });

          const src = p.path ? resolve(p.path) : undefined;
          if (src && existsSync(src)) {
            const skillMd = src.endsWith("SKILL.md") ? src : join(src, "SKILL.md");
            if (existsSync(skillMd) && statSync(skillMd).isFile()) {
              cpSync(skillMd, destFile);
            } else {
              writeFileSync(destFile, readPrimitiveContent(p, "SKILL.md"), "utf8");
            }
          } else {
            writeFileSync(destFile, readPrimitiveContent(p, "SKILL.md"), "utf8");
          }
          deployedFiles.push({ path: toPosixRel(cwd, destFile) });
          continue;
        }

        if (/instruction/.test(type)) {
          const destFile = join(cwd, ".cursor", "rules", `${name}.mdc`);
          assertUnderDeployRoots(cwd, destFile, roots);
          mkdirSync(join(cwd, ".cursor", "rules"), { recursive: true });
          writeFileSync(destFile, readPrimitiveContent(p), "utf8");
          deployedFiles.push({ path: toPosixRel(cwd, destFile) });
          continue;
        }

        if (/agent/.test(type)) {
          const destFile = join(cwd, ".cursor", "agents", `${name}.md`);
          assertUnderDeployRoots(cwd, destFile, roots);
          mkdirSync(join(cwd, ".cursor", "agents"), { recursive: true });
          writeFileSync(destFile, readPrimitiveContent(p), "utf8");
          deployedFiles.push({ path: toPosixRel(cwd, destFile) });
          continue;
        }

        // commands/hooks and other types: skip (not required for M5)
      }

      return { deployedFiles };
    },
  };
}
