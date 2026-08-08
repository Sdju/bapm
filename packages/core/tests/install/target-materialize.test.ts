/**
 * Install ↔ target registry integration: materialize once with resolved set;
 * core does not write harness paths (mock target does).
 * Registry unit contracts live in packages/integration-api/tests/.
 */
import { asText } from "../asText.ts";
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createFakePorts,
  createTempProject,
  getCreateIntegrationRegistry,
  getRegisterIntegration,
  getRunInstall,
  importIntegrationApi,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("install target materialize integration", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("materialize invoked once with conflict-resolved set, not duplicates", async () => {
    project = createTempProject();
    const ports = createFakePorts();
    mkdirSync(join(project.cwd, "leaf"), { recursive: true });
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: mat-once\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
      "utf8",
    );
    writeFileSync(
      join(project.cwd, "leaf", "apm.yml"),
      `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    writeText(
      join(project.cwd, ".apm", "skills", "shared", "SKILL.md"),
      "---\nname: shared\n---\n# Local\n",
    );
    writeText(
      join(project.cwd, "leaf", ".apm", "skills", "shared", "SKILL.md"),
      "---\nname: shared\n---\n# Dep\n",
    );
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });

    const api = await importIntegrationApi();
    const createRegistry = getCreateIntegrationRegistry(api);
    const registry = createRegistry();
    const register = getRegisterIntegration(api, registry);

    const calls: unknown[] = [];
    register({
      id: "cursor",
      deployRoots: [".agents/skills"],
      detect: () => true,
      materialize: async (primitives: unknown) => {
        calls.push(primitives);
      },
    });

    const runInstall = getRunInstall();
    await runInstall({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(calls.length).toBe(1);
    const payload = calls[0];
    const list = Array.isArray(payload)
      ? payload
      : payload &&
          typeof payload === "object" &&
          Array.isArray((payload as { primitives?: unknown }).primitives)
        ? (payload as { primitives: unknown[] }).primitives
        : null;
    expect(list).toBeTruthy();
    const shared = (list as Record<string, unknown>[]).filter((p) =>
      asText(p.name ?? p.id ?? "").includes("shared"),
    );
    expect(shared.length).toBe(1);
  });

  test("core does not write harness paths — only mock target writes under roots", async () => {
    project = createTempProject();
    const ports = createFakePorts();
    mkdirSync(join(project.cwd, "leaf"), { recursive: true });
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: spy-fs\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
      "utf8",
    );
    writeFileSync(
      join(project.cwd, "leaf", "apm.yml"),
      `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    writeText(
      join(project.cwd, "leaf", ".apm", "skills", "s1", "SKILL.md"),
      "---\nname: s1\n---\n# S1\n",
    );
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });

    const api = await importIntegrationApi();
    const createRegistry = getCreateIntegrationRegistry(api);
    const registry = createRegistry();
    const register = getRegisterIntegration(api, registry);

    const mockWrites: string[] = [];
    const outsideProbe = join(project.cwd, ".agents", "skills", "s1", "SKILL.md");
    register({
      id: "cursor",
      deployRoots: [".agents/skills"],
      detect: () => true,
      materialize: async () => {
        const dest = join(project.cwd, ".agents", "skills", "s1", "SKILL.md");
        mkdirSync(join(project.cwd, ".agents", "skills", "s1"), { recursive: true });
        writeFileSync(dest, "# deployed by mock\n", "utf8");
        mockWrites.push(dest);
      },
    });

    // Marker that core must not create on its own before mock runs
    expect(existsSync(outsideProbe)).toBe(false);

    const runInstall = getRunInstall();
    await runInstall({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(mockWrites.length).toBeGreaterThanOrEqual(1);
    expect(existsSync(outsideProbe)).toBe(true);
    expect(readFileSync(outsideProbe, "utf8")).toMatch(/deployed by mock/);
  });
});
