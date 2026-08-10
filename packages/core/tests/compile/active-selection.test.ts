/**
 * Compile uses sole `active` or requires `--target` for multi.
 * Promoted from manifest-active-targets acceptance.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { compileAgentsMd } from "../../src/index.ts";
import { createIntegrationRegistry } from "@b-apm/integration-api";

type Project = { cwd: string; cleanup: () => void };

function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

function createProject(yaml: string): Project {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-active-compile-"));
  writeText(join(cwd, "bapm.yml"), yaml);
  writeText(join(cwd, ".apm", "instructions", "guide.md"), "# Guide\n");
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

describe("compile active selection", () => {
  let project: Project | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("sole active selects compile host without detect", async () => {
    project = createProject(
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

    const registry = createIntegrationRegistry();
    let compileCalls = 0;
    registry.register({
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

    await compileAgentsMd({
      cwd: project.cwd,
      integrationRegistry: registry,
    } as never);

    expect(compileCalls).toBe(1);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(true);
  });

  test("multi active without forcedTarget fails even when sole detect would succeed", async () => {
    project = createProject(
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

    const registry = createIntegrationRegistry();

    // cursor alone would detect — without honouring multi `active`, compile would succeed.
    registry.register({
      id: "cursor",
      deployRoots: [".agents"],
      detect: () => true,
      materialize: async () => ({ targetId: "cursor", deployedFiles: [] }),
      compile: async () => {
        throw new Error("compile must not run when multi active requires --target");
      },
    });
    registry.register({
      id: "x-acme-editor",
      deployRoots: [".acme"],
      detect: () => false,
      materialize: async () => ({ targetId: "x-acme-editor", deployedFiles: [] }),
      compile: async () => {
        throw new Error("compile must not run for x-acme-editor");
      },
    });

    await expect(
      compileAgentsMd({
        cwd: project.cwd,
        integrationRegistry: registry,
      } as never),
    ).rejects.toThrow(/--target\s+<id>/i);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });

  test("forcedTarget overrides multi active for compile", async () => {
    project = createProject(
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

    const registry = createIntegrationRegistry();
    const compiled: string[] = [];

    for (const id of ["cursor", "x-acme-editor"]) {
      registry.register({
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

    await compileAgentsMd({
      cwd: project.cwd,
      integrationRegistry: registry,
      forcedTarget: "cursor",
    } as never);

    expect(compiled).toEqual(["cursor"]);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(project.cwd, "ACME.md"))).toBe(false);
  });
});
