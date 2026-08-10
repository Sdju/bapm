/**
 * target/targets wire during install (tg-008 / tg-004).
 * Mutual exclusion of target+targets is covered by manifest/validate.test.ts.
 */
import { asText } from "../asText.ts";
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseManifest } from "@b-apm/core";
import {
  createFakePorts,
  createTempProject,
  getRegisterIntegration,
  getCreateIntegrationRegistry,
  getRunInstall,
  importIntegrationApi,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("target/targets wire (tg-008 / tg-004)", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("intersection — dep targets:[copilot] not deployed to active cursor", async () => {
    project = createTempProject();
    const ports = createFakePorts();
    mkdirSync(join(project.cwd, "copilot-only"), { recursive: true });
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: intersect\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm:\n    - path: ./copilot-only\n`,
      "utf8",
    );
    writeFileSync(
      join(project.cwd, "copilot-only", "apm.yml"),
      `name: copilot-only\nversion: 0.0.1\ntargets:\n  - copilot\ndependencies:\n  apm: []\n`,
      "utf8",
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
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(materializedNames).not.toContain("co");
    expect(existsSync(join(project.cwd, ".agents", "skills", "co", "SKILL.md"))).toBe(false);
  });

  test("vendor id x-acme-editor accepted as id (tg-004)", () => {
    const doc = parseManifest({
      name: "vendor",
      version: "0.0.1",
      target: "x-acme-editor",
      dependencies: { apm: [] },
    }) as Record<string, unknown>;
    expect(asText(doc.target)).toBe("x-acme-editor");
  });
});
