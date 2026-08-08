/**
 * Acceptance (RED): install host selection via manifest `active`.
 * OpenSpec change: manifest-active-targets
 * Spec: manifest-active-targets / install-pipeline
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import {
  createTempProject,
  getCreateIntegrationRegistry,
  getRegisterIntegration,
  getRunInstall,
  importIntegrationApi,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("manifest-active-targets install — selection priority", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("sole active materializes without --target or detect", async () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.yml"),
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

    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    const register = getRegisterIntegration(api, registry);
    const materialized: string[] = [];
    register({
      id: "cursor",
      deployRoots: [".agents"],
      detect: () => false,
      materialize: async () => {
        materialized.push("cursor");
        return { targetId: "cursor", deployedFiles: [] };
      },
    });

    const result = (await getRunInstall()({
      cwd: project.cwd,
      integrationRegistry: registry,
      noPolicy: true,
    })) as { ok?: boolean; activeTargets?: string[] };

    expect(result).toMatchObject({ ok: true, activeTargets: ["cursor"] });
    expect(materialized).toEqual(["cursor"]);
  });

  test("multi active materializes each registered host without detect", async () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.yml"),
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

    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    const register = getRegisterIntegration(api, registry);
    const materialized: string[] = [];

    for (const id of ["cursor", "x-acme-editor"]) {
      register({
        id,
        deployRoots: [`.${id}`],
        detect: () => false,
        materialize: async () => {
          materialized.push(id);
          return { targetId: id, deployedFiles: [] };
        },
      });
    }

    const result = (await getRunInstall()({
      cwd: project.cwd,
      integrationRegistry: registry,
      noPolicy: true,
    })) as { ok?: boolean; activeTargets?: string[] };

    expect(result).toMatchObject({
      ok: true,
      activeTargets: ["cursor", "x-acme-editor"],
    });
    expect(materialized).toEqual(["cursor", "x-acme-editor"]);
  });

  test("forcedTarget overrides multi active", async () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.yml"),
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

    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    const register = getRegisterIntegration(api, registry);
    const materialized: string[] = [];

    for (const id of ["cursor", "x-acme-editor"]) {
      register({
        id,
        deployRoots: [`.${id}`],
        detect: () => false,
        materialize: async () => {
          materialized.push(id);
          return { targetId: id, deployedFiles: [] };
        },
      });
    }

    const result = (await getRunInstall()({
      cwd: project.cwd,
      integrationRegistry: registry,
      forcedTarget: "cursor",
      noPolicy: true,
    })) as { ok?: boolean; activeTargets?: string[] };

    expect(result).toMatchObject({ ok: true, activeTargets: ["cursor"] });
    expect(materialized).toEqual(["cursor"]);
  });

  test("absent active keeps detect-or-fail path (no invent from targets alone)", async () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.yml"),
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

    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    const register = getRegisterIntegration(api, registry);
    const materialized: string[] = [];
    register({
      id: "cursor",
      deployRoots: [".agents"],
      detect: () => false,
      materialize: async () => {
        materialized.push("cursor");
      },
    });

    await expect(
      getRunInstall()({
        cwd: project.cwd,
        integrationRegistry: registry,
        noPolicy: true,
      }),
    ).rejects.toThrow(/--target\s+<id>/i);
    expect(materialized).toEqual([]);
  });
});

describe("manifest-active-targets install — unknown ids fail closed", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("unknown sole active id fails without materialize", async () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.yml"),
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

    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    const register = getRegisterIntegration(api, registry);
    const materialized: string[] = [];
    register({
      id: "cursor",
      deployRoots: [".agents"],
      detect: () => false,
      materialize: async () => {
        materialized.push("cursor");
      },
    });

    await expect(
      getRunInstall()({
        cwd: project.cwd,
        integrationRegistry: registry,
        noPolicy: true,
      }),
    ).rejects.toThrow(/x-missing/);
    expect(materialized).toEqual([]);
  });

  test("one unknown among several aborts all before any materialize", async () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.yml"),
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

    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    const register = getRegisterIntegration(api, registry);
    const materialized: string[] = [];
    register({
      id: "cursor",
      deployRoots: [".agents"],
      detect: () => false,
      materialize: async () => {
        materialized.push("cursor");
        return { targetId: "cursor", deployedFiles: [] };
      },
    });

    await expect(
      getRunInstall()({
        cwd: project.cwd,
        integrationRegistry: registry,
        noPolicy: true,
      }),
    ).rejects.toThrow(/x-missing/);
    expect(materialized).toEqual([]);
  });
});
