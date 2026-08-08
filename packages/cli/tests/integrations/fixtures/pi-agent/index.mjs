import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Valid runtime integration for local-path map suites (id: x-pi-agent). */
export function createIntegration() {
  return {
    id: "x-pi-agent",
    deployRoots: [".pi/skills"],
    detect: () => false,
    async materialize(primitives, ctx) {
      const cwd = ctx?.cwd ?? process.cwd();
      const marker = join(cwd, ".pi", "materialized");
      mkdirSync(dirname(marker), { recursive: true });
      writeFileSync(marker, "x-pi-agent", "utf8");
      const list = Array.isArray(primitives)
        ? primitives
        : (primitives?.primitives ?? []);
      const deployedFiles = [];
      for (const p of list) {
        const name = String(p.name ?? "unnamed");
        const dest = join(cwd, ".pi", "skills", name, "SKILL.md");
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, `# ${name}\n`, "utf8");
        deployedFiles.push({ path: `.pi/skills/${name}/SKILL.md`, primitive: { name } });
      }
      return { targetId: "x-pi-agent", deployedFiles };
    },
    async compile(_primitives, context) {
      const path = "PI.md";
      const content = "# x-pi-agent local-path compile\n";
      if (context?.write) {
        const abs = join(context.cwd ?? process.cwd(), path);
        writeFileSync(abs, content, "utf8");
      }
      return { path, content, wrote: Boolean(context?.write) };
    },
  };
}
