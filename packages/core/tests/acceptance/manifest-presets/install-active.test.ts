/**
 * Acceptance (RED): install host selection uses resolved target ids from structured active.
 * OpenSpec change: manifest-presets
 * Spec: manifest-active-targets
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { createTempProject, getRunInstall, join, writeText, type TempProject } from "./helpers.ts";

async function importIntegrationApi(): Promise<Record<string, unknown>> {
  return (await import("@b-apm/integration-api")) as Record<string, unknown>;
}

function createRegistry(api: Record<string, unknown>): unknown {
  const fn = api.createIntegrationRegistry;
  if (typeof fn !== "function") {
    throw new TypeError("expected @b-apm/integration-api to export createIntegrationRegistry");
  }
  return (fn as () => unknown)();
}

function registerOn(api: Record<string, unknown>, registry: unknown): (target: unknown) => void {
  if (registry && typeof registry === "object") {
    const reg = registry as Record<string, unknown>;
    if (typeof reg.register === "function") {
      return (target: unknown) => {
        (reg.register as (t: unknown) => unknown)(target);
      };
    }
  }
  const fn = api.registerTarget ?? api.register;
  if (typeof fn !== "function") {
    throw new TypeError("expected registry.register or registerTarget");
  }
  return fn as (target: unknown) => void;
}

describe("manifest-presets install — structured active targets", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("sole structured target active materializes without --target", async () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.yml"),
      [
        "name: sole-structured-active",
        "version: 0.0.1",
        "active:",
        "  target: cursor",
        "dependencies:",
        "  apm: []",
        "",
      ].join("\n"),
    );

    const api = await importIntegrationApi();
    const registry = createRegistry(api);
    const register = registerOn(api, registry);
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

  test("preset-only active does not invent host activation", async () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.yml"),
      [
        "name: preset-only-hosts",
        "version: 0.0.1",
        "presets:",
        "  - name: developer",
        "    dependencies:",
        "      apm: []",
        "active:",
        "  preset: developer",
        "dependencies:",
        "  apm: []",
        "",
      ].join("\n"),
    );

    const api = await importIntegrationApi();
    const registry = createRegistry(api);
    const register = registerOn(api, registry);
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

    try {
      const result = (await getRunInstall()({
        cwd: project.cwd,
        integrationRegistry: registry,
        noPolicy: true,
      })) as { ok?: boolean; activeTargets?: string[] };
      // If install somehow succeeds without force/detect, it must not activate from presets.
      expect(result.activeTargets ?? []).not.toContain("developer");
      expect(materialized).not.toContain("developer");
      expect(materialized).toEqual([]);
    } catch (error) {
      // detect-then-fail is also acceptable for preset-only active.
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toMatch(/target|detect|host|active|ambiguous|no .+selected/i);
      expect(materialized).toEqual([]);
    }
  });

  test("forcedTarget still overrides structured multi-target active", async () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.yml"),
      [
        "name: force-over-structured",
        "version: 0.0.1",
        "active:",
        "  target:",
        "    - cursor",
        "    - x-acme-editor",
        "dependencies:",
        "  apm: []",
        "",
      ].join("\n"),
    );

    const api = await importIntegrationApi();
    const registry = createRegistry(api);
    const register = registerOn(api, registry);
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
      forcedTarget: "cursor",
      target: "cursor",
    })) as { ok?: boolean; activeTargets?: string[] };

    expect(result).toMatchObject({ ok: true });
    expect(result.activeTargets ?? materialized).toEqual(["cursor"]);
    expect(materialized).toEqual(["cursor"]);
  });
});
