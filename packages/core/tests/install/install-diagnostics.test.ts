/**
 * Install diagnostics must reach the result: unsupported primitives, MCP
 * opt-in skips, and target allow-list filtering.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createIntegrationRegistry } from "@b-apm/integration-api";
import { createCursorIntegration } from "@b-apm/integration-cursor";
import { createOpencodeIntegration } from "@b-apm/integration-opencode";
import {
  createTempProject,
  getRunInstall,
  writeText,
  type TempProject,
} from "./commands-hooks-helpers.ts";
import { existingLockPath } from "./helpers.ts";

type InstallResultWithDiagnostics = {
  ok: boolean;
  diagnostics: Array<Record<string, unknown>>;
  activeTargets: string[];
};

function registryWith(
  ...targets: Array<{ id: string }>
): ReturnType<typeof createIntegrationRegistry> {
  const registry = createIntegrationRegistry();
  for (const target of targets) {
    registry.register(target as never);
  }
  return registry;
}

function writeLeafSkill(cwd: string): void {
  writeText(join(cwd, "leaf/apm.yml"), "name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n");
  writeText(join(cwd, "leaf/.apm/skills/hello/SKILL.md"), "---\nname: hello\n---\n# Hello\n");
}

describe("install diagnostics visibility", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("unsupported primitive skip reaches result diagnostics with warn", async () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "dep/apm.yml"),
      "name: hook-dep\nversion: 0.0.1\ndependencies:\n  apm: []\n",
    );
    writeText(
      join(project.cwd, "dep/.apm/hooks/pre-tool.json"),
      `${JSON.stringify({ hooks: { sessionStart: [{ command: "./scripts/x.sh" }] } }, null, 2)}\n`,
    );
    writeText(
      join(project.cwd, "bapm.yml"),
      "name: skip-diagnostics\nversion: 0.0.1\ntarget: opencode\ndependencies:\n  apm:\n    - path: ./dep\n",
    );
    mkdirSync(join(project.cwd, ".opencode"), { recursive: true });

    const registry = registryWith(createOpencodeIntegration());
    const result = (await getRunInstall()({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
      noPolicy: true,
    })) as InstallResultWithDiagnostics;

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "OPENCODE_HOOKS_UNSUPPORTED",
          warn: true,
        }),
      ]),
    );
    expect(existsSync(join(project.cwd, ".opencode", "hooks.json"))).toBe(false);
    expect(existsSync(join(project.cwd, ".opencode", "hooks"))).toBe(false);
  });

  test("empty target intersection fails closed and rolls back a fresh lock", async () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.yml"),
      [
        "name: empty-intersection",
        "version: 0.0.1",
        "targets:",
        '  cursor: "./cursor"',
        "dependencies:",
        "  apm:",
        "    - path: ./leaf",
        "",
      ].join("\n"),
    );
    writeLeafSkill(project.cwd);

    const registry = registryWith(createCursorIntegration(), createOpencodeIntegration());

    await expect(
      getRunInstall()({
        cwd: project.cwd,
        frozen: false,
        forcedTarget: "opencode",
        integrationRegistry: registry,
        registry,
        noPolicy: true,
      }),
    ).rejects.toMatchObject({
      code: "INSTALL_TARGETS_EMPTY_INTERSECTION",
      message: expect.stringMatching(/opencode[\s\S]*cursor/i),
    });

    expect(existsSync(join(project.cwd, ".opencode"))).toBe(false);
    expect(existingLockPath(project.cwd)).toBeUndefined();
  });

  test("partial intersection warns and skips only the undeclared active host", async () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.yml"),
      [
        "name: partial-intersection",
        "version: 0.0.1",
        "active:",
        "  target:",
        "    - cursor",
        "    - opencode",
        "targets:",
        '  cursor: "./cursor"',
        "dependencies:",
        "  apm:",
        "    - path: ./leaf",
        "",
      ].join("\n"),
    );
    writeLeafSkill(project.cwd);

    const registry = registryWith(createCursorIntegration(), createOpencodeIntegration());
    const result = (await getRunInstall()({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
      noPolicy: true,
    })) as InstallResultWithDiagnostics;

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INSTALL_TARGET_SKIPPED_BY_TARGETS",
          warn: true,
          skippedTargets: ["opencode"],
          declaredTargets: ["cursor"],
        }),
      ]),
    );
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(true);
    expect(existsSync(join(project.cwd, ".opencode"))).toBe(false);
  });
});
