/**
 * M4 checklist C §13–15 — target/targets wire (tg-008 / tg-004).
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadManifest, parseManifest } from "@bapm/core";
import {
  createFakePorts,
  createTempProject,
  expectThrowsMatching,
  getRegisterTarget,
  getCreateRegistry,
  getRunInstall,
  importTargetApi,
  writeManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("M4 target/targets wire tg-008 / tg-004 (§13–15)", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("mutual exclusion — both target and targets → hard error (§13)", () => {
    expectThrowsMatching(
      () =>
        parseManifest({
          name: "both",
          version: "0.0.1",
          target: "cursor",
          targets: ["copilot"],
          dependencies: { apm: [] },
        }),
      /target/i,
    );

    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: both\nversion: 0.0.1\ntarget: cursor\ntargets:\n  - copilot\ndependencies:\n  apm: []\n`,
    );
    expectThrowsMatching(() => loadManifest({ cwd: project.cwd }), /target/i);
  });

  test("intersection — dep targets:[copilot] not deployed to active cursor (§14)", async () => {
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

    const api = await importTargetApi();
    const registry = getCreateRegistry(api)();
    const register = getRegisterTarget(api, registry);
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
          materializedNames.push(String(p.name ?? p.id ?? ""));
        }
      },
    });

    const runInstall = getRunInstall();
    await runInstall({
      cwd: project.cwd,
      frozen: false,
      targetRegistry: registry,
      registry,
      activeTargets: ["cursor"],
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(materializedNames).not.toContain("co");
    expect(existsSync(join(project.cwd, ".agents", "skills", "co", "SKILL.md"))).toBe(
      false,
    );
  });

  test("vendor id x-acme-editor accepted as id (tg-004) (§15)", () => {
    const doc = parseManifest({
      name: "vendor",
      version: "0.0.1",
      target: "x-acme-editor",
      dependencies: { apm: [] },
    }) as Record<string, unknown>;
    expect(String(doc.target)).toBe("x-acme-editor");
  });
});
