/**
 * Acceptance (RED): compile uses sole `active` or requires `--target` for multi.
 * OpenSpec change: manifest-active-targets
 * Spec: compile-agents-md / manifest-active-targets
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  getCompileAgentsMd,
  getCreateIntegrationRegistry,
  getRegisterIntegration,
  importIntegrationApi,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("manifest-active-targets compile — sole vs multi active", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("sole active selects compile host without detect", async () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.yml"),
      [
        "name: compile-sole-active",
        "version: 0.0.1",
        "active:",
        "  - cursor",
        "dependencies:",
        "  apm: []",
        "",
      ].join("\n"),
    );
    writeText(join(project.cwd, ".apm", "instructions", "guide.md"), "# Guide\n");

    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    const register = getRegisterIntegration(api, registry);
    let compileCalls = 0;
    register({
      id: "cursor",
      deployRoots: [".agents"],
      detect: () => false,
      materialize: async () => ({ targetId: "cursor", deployedFiles: [] }),
      compile: async (_primitives: unknown, context: { cwd?: string; write?: boolean }) => {
        compileCalls += 1;
        const path = "AGENTS.md";
        const content = "# compiled via sole active\n";
        if (context?.write) {
          writeText(join(context.cwd ?? project!.cwd, path), content);
        }
        return { path, content, wrote: Boolean(context?.write) };
      },
    });

    await getCompileAgentsMd()({
      cwd: project.cwd,
      integrationRegistry: registry,
    });

    expect(compileCalls).toBe(1);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(true);
  });

  test("multi active without forcedTarget fails even when sole detect would succeed", async () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.yml"),
      [
        "name: compile-multi-active",
        "version: 0.0.1",
        "active:",
        "  - cursor",
        "  - x-acme-editor",
        "dependencies:",
        "  apm: []",
        "",
      ].join("\n"),
    );
    writeText(join(project.cwd, ".apm", "instructions", "guide.md"), "# Guide\n");

    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    const register = getRegisterIntegration(api, registry);

    // cursor alone would detect — without honouring multi `active`, compile would succeed.
    register({
      id: "cursor",
      deployRoots: [".agents"],
      detect: () => true,
      materialize: async () => ({ targetId: "cursor", deployedFiles: [] }),
      compile: async () => {
        throw new Error("compile must not run when multi active requires --target");
      },
    });
    register({
      id: "x-acme-editor",
      deployRoots: [".acme"],
      detect: () => false,
      materialize: async () => ({ targetId: "x-acme-editor", deployedFiles: [] }),
      compile: async () => {
        throw new Error("compile must not run for x-acme-editor");
      },
    });

    await expect(
      getCompileAgentsMd()({
        cwd: project.cwd,
        integrationRegistry: registry,
      }),
    ).rejects.toThrow(/--target\s+<id>/i);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });

  test("forcedTarget overrides multi active for compile", async () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.yml"),
      [
        "name: compile-force-active",
        "version: 0.0.1",
        "active:",
        "  - cursor",
        "  - x-acme-editor",
        "dependencies:",
        "  apm: []",
        "",
      ].join("\n"),
    );
    writeText(join(project.cwd, ".apm", "instructions", "guide.md"), "# Guide\n");

    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    const register = getRegisterIntegration(api, registry);
    const compiled: string[] = [];

    for (const id of ["cursor", "x-acme-editor"]) {
      register({
        id,
        deployRoots: [`.${id}`],
        detect: () => false,
        materialize: async () => ({ targetId: id, deployedFiles: [] }),
        compile: async (_primitives: unknown, context: { cwd?: string; write?: boolean }) => {
          compiled.push(id);
          const path = id === "cursor" ? "AGENTS.md" : "ACME.md";
          const content = `# ${id}\n`;
          if (context?.write) {
            writeText(join(context.cwd ?? project!.cwd, path), content);
          }
          return { path, content, wrote: Boolean(context?.write) };
        },
      });
    }

    await getCompileAgentsMd()({
      cwd: project.cwd,
      integrationRegistry: registry,
      forcedTarget: "cursor",
    });

    expect(compiled).toEqual(["cursor"]);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(project.cwd, "ACME.md"))).toBe(false);
  });
});
