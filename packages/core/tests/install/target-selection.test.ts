import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInstall } from "../../src/index.ts";
import { createIntegrationRegistry } from "@b-apm/integration-api";

type Project = { cwd: string; cleanup: () => void };

function createProject(): Project {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-integration-orchestration-"));
  writeFileSync(
    join(cwd, "bapm.yml"),
    "name: target-orchestration\nversion: 0.0.1\ndependencies:\n  apm: []\n",
    "utf8",
  );
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

describe("install target selection", () => {
  let project: Project | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("rejects ambiguous detection before either detected target materializes", async () => {
    project = createProject();
    const registry = createIntegrationRegistry();
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
        integrationRegistry: registry,
        noPolicy: true,
      }),
    ).rejects.toThrow(/--target\s+<id>/i);
    expect(materialized).toEqual([]);
  });

  test("accepts a registered non-Cursor exclude without skipping materialization", async () => {
    project = createProject();
    const registry = createIntegrationRegistry();
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
        integrationRegistry: registry,
        excludeTargets: ["x-acme-editor"],
        noPolicy: true,
      }),
    ).resolves.toMatchObject({ ok: true, activeTargets: ["x-acme-editor"] });
    expect(materialized).toBe(1);
  });
});
