/**
 * Install: object-map keys participate in intersection; values do not load integrations.
 * Promoted from manifest-target-integration-map acceptance.
 */
import { asText } from "../asText.ts";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
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

/** Package name that must never be resolved/loaded from the map value alone. */
const FAKE_INTEGRATION_PKG = "@bapm/integration-DOES-NOT-EXIST-acceptance-map";

describe("install target integration map — keys only, no value load", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("install with object-map targets treats keys as declared ids and does not load map values", async () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.yml"),
      [
        "name: map-root",
        "version: 0.0.1",
        "targets:",
        `  cursor: "${FAKE_INTEGRATION_PKG}"`,
        "dependencies:",
        "  apm: []",
        "",
      ].join("\n"),
    );
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });

    // Precondition: the map-value package is not resolvable from this workspace.
    const req = createRequire(import.meta.url);
    expect(() => req.resolve(FAKE_INTEGRATION_PKG)).toThrow();

    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    const register = getRegisterIntegration(api, registry);
    let materializeCalls = 0;
    register({
      id: "cursor",
      deployRoots: [".agents/skills"],
      detect: () => true,
      materialize: async () => {
        materializeCalls += 1;
        return { targetId: "cursor", deployedFiles: [] };
      },
    });

    const runInstall = getRunInstall();
    await runInstall({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
      activeTargets: ["cursor"],
    });

    // Registered cursor path ran; nonexistent map-value package was not required for success.
    expect(materializeCalls).toBeGreaterThanOrEqual(1);
    expect(() => req.resolve(FAKE_INTEGRATION_PKG)).toThrow();
  });

  test("object-map keys participate in intersection (non-overlapping dep skipped)", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, "copilot-only"), { recursive: true });
    writeText(
      join(project.cwd, "bapm.yml"),
      [
        "name: intersect-map",
        "version: 0.0.1",
        "targets:",
        `  cursor: "${FAKE_INTEGRATION_PKG}"`,
        "dependencies:",
        "  apm:",
        "    - path: ./copilot-only",
        "",
      ].join("\n"),
    );
    writeText(
      join(project.cwd, "copilot-only", "apm.yml"),
      [
        "name: copilot-only",
        "version: 0.0.1",
        "targets:",
        "  - copilot",
        "dependencies:",
        "  apm: []",
        "",
      ].join("\n"),
    );
    writeText(
      join(project.cwd, "copilot-only", ".apm", "skills", "co", "SKILL.md"),
      "---\nname: co\n---\n# Copilot only\n",
    );
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });

    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    const register = getRegisterIntegration(api, registry);
    const materializedNames: string[] = [];
    register({
      id: "cursor",
      deployRoots: [".agents/skills"],
      detect: () => true,
      materialize: async (primitives: unknown) => {
        const list = Array.isArray(primitives)
          ? primitives
          : ((primitives as { primitives?: unknown[] })?.primitives ?? []);
        for (const p of list as Record<string, unknown>[]) {
          materializedNames.push(asText(p.name ?? p.id ?? ""));
        }
      },
    });

    const runInstall = getRunInstall();
    await runInstall({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
      activeTargets: ["cursor"],
    });

    expect(materializedNames).not.toContain("co");
    expect(existsSync(join(project.cwd, ".agents", "skills", "co", "SKILL.md"))).toBe(false);
  });
});
