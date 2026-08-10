/**
 * Install precedence: local active over base; CLI forcedTarget over local
 * (promoted from manifest-local-overlay acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { createIntegrationRegistry } from "@b-apm/integration-api";
import {
  conformingBase,
  createTempProject,
  getRunInstall,
  writeBaseManifest,
  writeLocalOverlay,
  type TempProject,
} from "../manifest/local-overlay-helpers.ts";

describe("manifest-local-overlay — install precedence", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("local active overrides base active without --target", async () => {
    project = createTempProject();
    writeBaseManifest(
      project.cwd,
      conformingBase({
        name: "local-over-base",
        extraYaml: "active:\n  - cursor\n",
      }),
    );
    writeLocalOverlay(project.cwd, "active:\n  - x-acme-editor\n");

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

    const result = await getRunInstall()({
      cwd: project.cwd,
      integrationRegistry: registry,
      noPolicy: true,
    });

    expect(result).toMatchObject({ ok: true, activeTargets: ["x-acme-editor"] });
    expect(materialized).toEqual(["x-acme-editor"]);
  });

  test("CLI forcedTarget overrides local active", async () => {
    project = createTempProject();
    writeBaseManifest(
      project.cwd,
      conformingBase({
        name: "flag-over-local",
        extraYaml: "active:\n  - cursor\n",
      }),
    );
    writeLocalOverlay(project.cwd, "active:\n  - x-acme-editor\n");

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

    const result = await getRunInstall()({
      cwd: project.cwd,
      integrationRegistry: registry,
      forcedTarget: "cursor",
      noPolicy: true,
    });

    expect(result).toMatchObject({ ok: true, activeTargets: ["cursor"] });
    expect(materialized).toEqual(["cursor"]);
  });

  test("local active used when base omits active", async () => {
    project = createTempProject();
    writeBaseManifest(project.cwd, conformingBase({ name: "local-only-active" }));
    writeLocalOverlay(project.cwd, "active:\n  - cursor\n");

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

    const result = await getRunInstall()({
      cwd: project.cwd,
      integrationRegistry: registry,
      noPolicy: true,
    });

    expect(result).toMatchObject({ ok: true, activeTargets: ["cursor"] });
    expect(materialized).toEqual(["cursor"]);
  });
});
