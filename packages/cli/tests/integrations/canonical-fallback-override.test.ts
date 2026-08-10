/**
 * Map overrides canonical; custom hosts require map; canonical fallback.
 * Promoted from docs-host-happy-path acceptance.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { createCliIntegrationRegistry } from "../../src/app/integrations/registry.ts";
import { registerManifestIntegrationsFromCwd } from "../../src/app/integrations/loadManifestIntegrations.ts";
import {
  createTempProject,
  cursorOverrideMarker,
  expectKnownFlags,
  existsSync,
  join,
  linkClaudeIntegration,
  linkCursorIntegration,
  plantCursorOverridePackage,
  plantCustomHostPackage,
  readFileSync,
  runInProject,
  skillPath,
  writeNoMapProject,
  type TempProject,
} from "../install/canonical-host-helpers.ts";

describe("CLI integrations · map override + canonical fallback + custom map-only", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("absent targets: still registers resolvable canonical cursor (fallback load)", async () => {
    project = createTempProject();
    linkCursorIntegration(project.cwd);
    writeNoMapProject(project.cwd, {
      name: "acc-registry-canonical",
      withLeafSkill: false,
    });

    const registry = createCliIntegrationRegistry();
    await registerManifestIntegrationsFromCwd(registry, project.cwd);

    expect(registry.get("cursor")?.id).toBe("cursor");
    expect(registry.get("x-custom-unmapped")).toBeUndefined();
  });

  test("map entry overrides canonical cursor; unmapped claude still loads via canonical fallback", async () => {
    project = createTempProject();
    linkCursorIntegration(project.cwd);
    linkClaudeIntegration(project.cwd);
    const overrideSpec = plantCursorOverridePackage(project.cwd);
    writeNoMapProject(project.cwd, {
      name: "acc-map-override-fallback",
      withLeafSkill: true,
      targets: { cursor: overrideSpec },
      // no claude map entry — must still resolve @b-apm/integration-claude
    });

    const registry = createCliIntegrationRegistry();
    await registerManifestIntegrationsFromCwd(registry, project.cwd);
    expect(registry.get("cursor")?.id).toBe("cursor");
    expect(registry.get("claude")?.id).toBe("claude");

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(existsSync(cursorOverrideMarker(project.cwd))).toBe(true);
    expect(readFileSync(cursorOverrideMarker(project.cwd), "utf8")).toContain(
      "map-override-cursor",
    );
    // Canonical cursor layout skills must not be the only proof — override marker is authoritative.
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(false);

    const claudeInstall = await runInProject(project.cwd, ["install", "--target", "claude"]);
    expectKnownFlags(claudeInstall.combined);
    expect(claudeInstall.combined).not.toMatch(/unknown or unregistered target:\s*claude/i);
    expect(claudeInstall.result).toBe(0);
  });

  test("custom host id only via map — without map entry stays unregistered / fail-closed", async () => {
    project = createTempProject();
    linkCursorIntegration(project.cwd);
    writeNoMapProject(project.cwd, {
      name: "acc-custom-no-map",
      withLeafSkill: true,
    });

    const registry = createCliIntegrationRegistry();
    await registerManifestIntegrationsFromCwd(registry, project.cwd);
    expect(registry.get("cursor")?.id).toBe("cursor");
    expect(registry.get("x-acme-custom")).toBeUndefined();

    const missing = await runInProject(project.cwd, ["install", "--target", "x-acme-custom"]);
    expectKnownFlags(missing.combined);
    expect(missing.result).not.toBe(0);
    expect(missing.combined).toMatch(/x-acme-custom|unknown or unregistered target/i);
    expect(existsSync(skillPath(project.cwd))).toBe(false);

    const customSpec = plantCustomHostPackage(project.cwd, "x-acme-custom");
    writeNoMapProject(project.cwd, {
      name: "acc-custom-with-map",
      withLeafSkill: true,
      targets: { "x-acme-custom": customSpec },
    });

    const withMap = await runInProject(project.cwd, ["install", "--target", "x-acme-custom"]);
    expectKnownFlags(withMap.combined);
    expect(withMap.result).toBe(0);
    expect(existsSync(join(project.cwd, ".custom-host", "materialized"))).toBe(true);
  });
});
