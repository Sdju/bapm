import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileAgentsMd, runInstall } from "../../../src/index.ts";
import { createTargetRegistry } from "bapm-target-api";

type Project = { cwd: string; cleanup: () => void };

function createProject(): Project {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-target-orchestration-"));
  writeFileSync(
    join(cwd, "bapm.yml"),
    "name: target-orchestration\nversion: 0.0.1\ndependencies:\n  apm: []\n",
    "utf8",
  );
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

describe("target-capability-orchestration acceptance", () => {
  let project: Project | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("install rejects ambiguous detection before either detected target materializes", async () => {
    project = createProject();
    const registry = createTargetRegistry();
    const materialized: string[] = [];

    for (const id of ["alpha", "beta"]) {
      registry.register({
        id,
        deployRoots: [`.${id}`],
        detect: () => true,
        materialize: async () => {
          materialized.push(id);
        },
      });
    }

    await expect(
      runInstall({
        cwd: project.cwd,
        targetRegistry: registry,
        noPolicy: true,
      }),
    ).rejects.toThrow(/--target\s+<id>/i);
    expect(materialized).toEqual([]);
  });

  test("install accepts a registered non-Cursor exclude without skipping materialization", async () => {
    project = createProject();
    const registry = createTargetRegistry();
    let materialized = 0;

    registry.register({
      id: "x-acme-editor",
      deployRoots: [".acme"],
      detect: () => true,
      materialize: async () => {
        materialized += 1;
      },
    });

    await expect(
      runInstall({
        cwd: project.cwd,
        targetRegistry: registry,
        excludeTargets: ["x-acme-editor"],
        noPolicy: true,
      }),
    ).resolves.toMatchObject({ ok: true, activeTargets: ["x-acme-editor"] });
    expect(materialized).toBe(1);
  });

  test("compile delegates default output and rendering to the forced target capability", async () => {
    project = createProject();
    mkdirSync(join(project.cwd, ".apm", "instructions"), { recursive: true });
    writeFileSync(join(project.cwd, ".apm", "instructions", "style.md"), "# Target-owned\n", "utf8");

    const registry = createTargetRegistry();
    const received: Array<{ override?: string; primitives: unknown }> = [];
    registry.register({
      id: "x-acme-editor",
      deployRoots: [".acme"],
      detect: () => false,
      materialize: async () => ({ deployedFiles: [] }),
      compile: async (primitives: unknown, context: { cwd: string; outputFile?: string }) => {
        received.push({ primitives, override: context.outputFile });
        const output = "HOST.md";
        writeFileSync(join(context.cwd, output), "# emitted by target\n", "utf8");
        return { path: output, content: "# emitted by target\n", wrote: true };
      },
    });

    const result = await Promise.resolve(
      compileAgentsMd({
        cwd: project.cwd,
        targetRegistry: registry,
        forcedTarget: "x-acme-editor",
      } as never),
    );

    expect(received).toHaveLength(1);
    expect(received[0]?.override).toBeUndefined();
    expect(result).toMatchObject({ wrote: true });
    expect(existsSync(join(project.cwd, "HOST.md"))).toBe(true);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });
});
