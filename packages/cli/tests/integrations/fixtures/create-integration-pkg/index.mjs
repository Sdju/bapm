import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Valid runtime integration via named `createIntegration` factory. */
export function createIntegration() {
  return {
    id: "x-acme-editor",
    deployRoots: [".acme/skills"],
    detect: () => false,
    async materialize(primitives, ctx) {
      const cwd = ctx?.cwd ?? process.cwd();
      const marker = join(cwd, ".acme", "materialized");
      mkdirSync(dirname(marker), { recursive: true });
      writeFileSync(marker, "x-acme-editor", "utf8");
      const list = Array.isArray(primitives) ? primitives : (primitives?.primitives ?? []);
      const deployedFiles = [];
      for (const p of list) {
        const name = String(p.name ?? "unnamed");
        const dest = join(cwd, ".acme", "skills", name, "SKILL.md");
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, `# ${name}\n`, "utf8");
        deployedFiles.push({ path: `.acme/skills/${name}/SKILL.md`, primitive: { name } });
      }
      return { targetId: "x-acme-editor", deployedFiles };
    },
    async compile(_primitives, context) {
      const path = "ACME.md";
      const content = "# ACME editor compile\n";
      if (context?.write) {
        const abs = join(context.cwd ?? process.cwd(), path);
        writeFileSync(abs, content, "utf8");
      }
      return { path, content, wrote: Boolean(context?.write) };
    },
  };
}
