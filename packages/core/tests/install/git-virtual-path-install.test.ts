/**
 * GitHub #30 install-level assertion: deploy the git virtual subpackage only.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  createTempProject,
  getCreateIntegrationRegistry,
  getRegisterIntegration,
  getRunInstall,
  importIntegrationApi,
  writeManifest,
  type TempProject,
} from "../install/helpers.ts";
import { createVirtualGitRepo } from "../resolve/helpers.ts";

describe("install git virtual package", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("deploys the subdirectory skill and not the repo-root skill", async () => {
    project = createTempProject();
    const repo = createVirtualGitRepo(project.cwd);
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: virtual-install\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm:\n    - git: ${JSON.stringify(repo)}\n      path: packages/leaf\n`,
    );

    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    const register = getRegisterIntegration(api, registry);
    const seen: string[] = [];
    register({
      id: "cursor",
      deployRoots: [".agents/skills"],
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
          seen.push(name);
          const dest = join(cwd, ".agents", "skills", name, "SKILL.md");
          mkdirSync(dirname(dest), { recursive: true });
          if (p.path && existsSync(p.path)) cpSync(p.path, dest);
          else writeFileSync(dest, `---\nname: ${name}\n---\n`, "utf8");
          deployedFiles.push({
            path: `.agents/skills/${name}/SKILL.md`,
            primitive: { name },
          });
        }
        return { targetId: "cursor", deployedFiles };
      },
    });

    await getRunInstall()({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
    });

    expect(seen).toContain("leaf");
    expect(seen).not.toContain("root-only");
    expect(existsSync(join(project.cwd, ".agents", "skills", "leaf", "SKILL.md"))).toBe(true);
    expect(existsSync(join(project.cwd, ".agents", "skills", "root-only", "SKILL.md"))).toBe(false);
  });
});
