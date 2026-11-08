/**
 * User-config target precedence:
 * CLI --target → local overlay active → manifest active → config target → detect.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { runInstall } from "../../src/index.ts";
import { createIntegrationRegistry } from "@b-apm/integration-api";

type Project = { cwd: string; cleanup: () => void };

function createProject(manifest: string, local?: string): Project {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-config-target-"));
  writeFileSync(join(cwd, "bapm.yml"), manifest, "utf8");
  if (local !== undefined) writeFileSync(join(cwd, "bapm.local.yml"), local, "utf8");
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

function registryWith(ids: string[], detected: string[] = []) {
  const registry = createIntegrationRegistry();
  for (const id of ids) {
    registry.register({
      id,
      deployRoots: [`.${id}`],
      detect: () => detected.includes(id),
      materialize: async () => ({ targetId: id, deployedFiles: [] }),
    });
  }
  return registry;
}

const EMPTY_DEPS = "dependencies:\n  apm: []\n";

describe("install config target precedence", () => {
  let project: Project | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("config target is used when manifest active is absent", async () => {
    project = createProject(`name: cfg-only\nversion: 0.0.1\n${EMPTY_DEPS}`);
    const result = await runInstall({
      cwd: project.cwd,
      integrationRegistry: registryWith(["cursor", "codex"]),
      configTarget: "codex",
      noPolicy: true,
    });
    expect(result.activeTargets).toEqual(["codex"]);
  });

  test("manifest active wins over config target", async () => {
    project = createProject(
      `name: cfg-vs-manifest\nversion: 0.0.1\nactive:\n  target: cursor\n${EMPTY_DEPS}`,
    );
    const result = await runInstall({
      cwd: project.cwd,
      integrationRegistry: registryWith(["cursor", "codex"]),
      configTarget: "codex",
      noPolicy: true,
    });
    expect(result.activeTargets).toEqual(["cursor"]);
  });

  test("local overlay active wins over manifest active and config target", async () => {
    project = createProject(
      `name: cfg-vs-overlay\nversion: 0.0.1\nactive:\n  target: cursor\n${EMPTY_DEPS}`,
      "active:\n  target: claude\n",
    );
    const result = await runInstall({
      cwd: project.cwd,
      integrationRegistry: registryWith(["cursor", "claude", "codex"]),
      configTarget: "codex",
      noPolicy: true,
    });
    expect(result.activeTargets).toEqual(["claude"]);
  });

  test("CLI forced target wins over local overlay and config target", async () => {
    project = createProject(
      `name: cfg-vs-cli\nversion: 0.0.1\nactive:\n  target: cursor\n${EMPTY_DEPS}`,
      "active:\n  target: claude\n",
    );
    const result = await runInstall({
      cwd: project.cwd,
      integrationRegistry: registryWith(["cursor", "claude", "codex", "opencode"]),
      forcedTarget: "opencode",
      configTarget: "codex",
      noPolicy: true,
    });
    expect(result.activeTargets).toEqual(["opencode"]);
  });

  test("sole detection is used only when active and config target are absent", async () => {
    project = createProject(`name: cfg-detect\nversion: 0.0.1\n${EMPTY_DEPS}`);
    const result = await runInstall({
      cwd: project.cwd,
      integrationRegistry: registryWith(["cursor", "codex"], ["cursor"]),
      noPolicy: true,
    });
    expect(result.activeTargets).toEqual(["cursor"]);
  });
});
