/**
 * Install host selection via manifest `active`.
 * Promoted from manifest-active-targets acceptance.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInstall } from "../../src/index.ts";
import { createIntegrationRegistry } from "@bapm/integration-api";

type Project = { cwd: string; cleanup: () => void };

function createProject(yaml: string): Project {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-active-install-"));
  writeFileSync(join(cwd, "bapm.yml"), yaml, "utf8");
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

describe("install active selection", () => {
  let project: Project | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("sole active materializes without --target or detect", async () => {
    project = createProject(
      [
        "name: sole-active",
        "version: 0.0.1",
        "active:",
        "  - cursor",
        "dependencies:",
        "  apm: []",
        "",
      ].join("\n"),
    );

    const registry = createIntegrationRegistry();
    const materialized: string[] = [];
    registry.register({
      id: "cursor",
      deployRoots: [".agents"],
      detect: () => false,
      materialize: async () => {
        materialized.push("cursor");
        return { targetId: "cursor", deployedFiles: [] };
      },
    });

    const result = await runInstall({
      cwd: project.cwd,
      integrationRegistry: registry,
      noPolicy: true,
    });

    expect(result).toMatchObject({ ok: true, activeTargets: ["cursor"] });
    expect(materialized).toEqual(["cursor"]);
  });

  test("multi active materializes each registered host without detect", async () => {
    project = createProject(
      [
        "name: multi-active",
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
    const materialized: string[] = [];

    for (const id of ["cursor", "x-acme-editor"]) {
      registry.register({
        id,
        deployRoots: [`.${id}`],
        detect: () => false,
        materialize: async () => {
          materialized.push(id);
          return { targetId: id, deployedFiles: [] };
        },
      });
    }

    const result = await runInstall({
      cwd: project.cwd,
      integrationRegistry: registry,
      noPolicy: true,
    });

    expect(result).toMatchObject({
      ok: true,
      activeTargets: ["cursor", "x-acme-editor"],
    });
    expect(materialized).toEqual(["cursor", "x-acme-editor"]);
  });

  test("forcedTarget overrides multi active", async () => {
    project = createProject(
      [
        "name: force-over-active",
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
    const materialized: string[] = [];

    for (const id of ["cursor", "x-acme-editor"]) {
      registry.register({
        id,
        deployRoots: [`.${id}`],
        detect: () => false,
        materialize: async () => {
          materialized.push(id);
          return { targetId: id, deployedFiles: [] };
        },
      });
    }

    const result = await runInstall({
      cwd: project.cwd,
      integrationRegistry: registry,
      forcedTarget: "cursor",
      noPolicy: true,
    });

    expect(result).toMatchObject({ ok: true, activeTargets: ["cursor"] });
    expect(materialized).toEqual(["cursor"]);
  });

  test("absent active keeps detect-or-fail path (no invent from targets alone)", async () => {
    project = createProject(
      [
        "name: no-active",
        "version: 0.0.1",
        "targets:",
        "  - cursor",
        "dependencies:",
        "  apm: []",
        "",
      ].join("\n"),
    );

    const registry = createIntegrationRegistry();
    const materialized: string[] = [];
    registry.register({
      id: "cursor",
      deployRoots: [".agents"],
      detect: () => false,
      materialize: async () => {
        materialized.push("cursor");
      },
    });

    await expect(
      runInstall({
        cwd: project.cwd,
        integrationRegistry: registry,
        noPolicy: true,
      }),
    ).rejects.toThrow(/--target\s+<id>/i);
    expect(materialized).toEqual([]);
  });

  test("unknown sole active id fails without materialize", async () => {
    project = createProject(
      [
        "name: unknown-active",
        "version: 0.0.1",
        "active:",
        "  - x-missing",
        "dependencies:",
        "  apm: []",
        "",
      ].join("\n"),
    );

    const registry = createIntegrationRegistry();
    const materialized: string[] = [];
    registry.register({
      id: "cursor",
      deployRoots: [".agents"],
      detect: () => false,
      materialize: async () => {
        materialized.push("cursor");
      },
    });

    await expect(
      runInstall({
        cwd: project.cwd,
        integrationRegistry: registry,
        noPolicy: true,
      }),
    ).rejects.toThrow(/x-missing/);
    expect(materialized).toEqual([]);
  });

  test("one unknown among several aborts all before any materialize", async () => {
    project = createProject(
      [
        "name: partial-active",
        "version: 0.0.1",
        "active:",
        "  - cursor",
        "  - x-missing",
        "dependencies:",
        "  apm: []",
        "",
      ].join("\n"),
    );

    const registry = createIntegrationRegistry();
    const materialized: string[] = [];
    registry.register({
      id: "cursor",
      deployRoots: [".agents"],
      detect: () => false,
      materialize: async () => {
        materialized.push("cursor");
        return { targetId: "cursor", deployedFiles: [] };
      },
    });

    await expect(
      runInstall({
        cwd: project.cwd,
        integrationRegistry: registry,
        noPolicy: true,
      }),
    ).rejects.toThrow(/x-missing/);
    expect(materialized).toEqual([]);
  });
});
