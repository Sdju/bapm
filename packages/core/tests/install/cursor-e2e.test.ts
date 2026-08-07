/**
 * Install ↔ mock target e2e: skills materialize via registry (no concrete cursor import).
 * Real cursor e2e lives under packages/cli and packages/integration-cursor.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createFakePorts,
  createTempProject,
  getCreateRegistry,
  getRegisterTarget,
  getRunInstall,
  importTargetApi,
  listFilesRecursive,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("install target materialize e2e (mock host)", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("mock cursor-like target — skill under registered root", async () => {
    project = createTempProject();
    const ports = createFakePorts();
    mkdirSync(join(project.cwd, "skill-dep"), { recursive: true });
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: cursor-e2e\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm:\n    - path: ./skill-dep\n`,
      "utf8",
    );
    writeFileSync(
      join(project.cwd, "skill-dep", "apm.yml"),
      `name: skill-dep\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    writeText(
      join(project.cwd, "skill-dep", ".apm", "skills", "hello", "SKILL.md"),
      "---\nname: hello\n---\n# Hello\n",
    );
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });

    const api = await importTargetApi();
    const registry = getCreateRegistry(api)();
    const register = getRegisterTarget(api, registry);
    register({
      id: "cursor",
      deployRoots: [".agents/skills", ".cursor"],
      detect: () => true,
      materialize: async (
        primitives: unknown,
        ctx?: { cwd?: string },
      ): Promise<{
        targetId: string;
        deployedFiles: Array<{ path: string; primitive: { name: string } }>;
      }> => {
        const cwd = ctx?.cwd ?? project.cwd;
        const list = Array.isArray(primitives)
          ? primitives
          : ((primitives as { primitives?: unknown[] })?.primitives ?? []);
        const deployedFiles: Array<{ path: string; primitive: { name: string } }> = [];
        for (const raw of list) {
          const p = raw as { name?: string; type?: string; path?: string };
          if (!/skill/i.test(String(p.type ?? "skill"))) continue;
          const name = String(p.name ?? "unnamed");
          const destDir = join(cwd, ".agents", "skills", name);
          mkdirSync(destDir, { recursive: true });
          const dest = join(destDir, "SKILL.md");
          const body =
            p.path && existsSync(p.path) ? undefined : "---\nname: hello\n---\n# Hello\n";
          if (p.path && existsSync(p.path)) {
            const { readFileSync, cpSync, statSync } = await import("node:fs");
            const src = p.path.endsWith("SKILL.md") ? p.path : join(p.path, "SKILL.md");
            if (existsSync(src) && statSync(src).isFile()) {
              cpSync(src, dest);
            } else {
              writeFileSync(dest, readFileSync(p.path, "utf8"), "utf8");
            }
          } else {
            writeFileSync(dest, body!, "utf8");
          }
          deployedFiles.push({
            path: `.agents/skills/${name}/SKILL.md`,
            primitive: { name },
          });
        }
        return { targetId: "cursor", deployedFiles };
      },
    });

    const runInstall = getRunInstall();
    await runInstall({
      cwd: project.cwd,
      frozen: false,
      targetRegistry: registry,
      registry,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    const tg003 = join(project.cwd, ".agents", "skills", "hello", "SKILL.md");
    const agentsSkills = existsSync(join(project.cwd, ".agents", "skills"))
      ? listFilesRecursive(join(project.cwd, ".agents", "skills"))
      : [];

    const deployed = existsSync(tg003) || agentsSkills.some((f) => /hello|SKILL\.md/i.test(f));
    expect(deployed).toBe(true);
    expect(existsSync(join(project.cwd, "hello", "SKILL.md"))).toBe(false);
  });
});
