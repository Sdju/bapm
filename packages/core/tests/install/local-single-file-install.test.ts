/**
 * Install/materialize local single-file dependencies through a real host
 * adapter (Cursor supports agent, instruction, and prompt/command types).
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { computeLocalSourceContentHash, loadLockfile } from "@b-apm/core";
import { createIntegrationRegistry } from "@b-apm/integration-api";
import { createCursorIntegration } from "@b-apm/integration-cursor";
import {
  createTempProject,
  expectRejectsMatching,
  getRunInstall,
  listFilesRecursive,
  writeManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";

const AGENT = "---\ndescription: Scout\n---\n# Scout\n";
const INSTRUCTION = "---\napplyTo: '**'\n---\n# Style\n";
const PROMPT = "---\ndescription: Review\n---\n# Review\n";

describe("local single-file install", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  function cursorRegistry() {
    const registry = createIntegrationRegistry();
    registry.register(createCursorIntegration());
    return registry;
  }

  function writeSingleFileProject(): void {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      [
        "name: local-single-file",
        "version: 0.0.1",
        "dependencies:",
        "  apm:",
        "    - path: ./ai/scout.agent.md",
        "    - path: ./ai/style.instructions.md",
        "    - path: ./ai/review.prompt.md",
        "",
      ].join("\n"),
    );
    writeText(join(project.cwd, "ai/scout.agent.md"), AGENT);
    writeText(join(project.cwd, "ai/style.instructions.md"), INSTRUCTION);
    writeText(join(project.cwd, "ai/review.prompt.md"), PROMPT);
  }

  function install(frozen = false): Promise<unknown> {
    const registry = cursorRegistry();
    return getRunInstall()({
      cwd: project.cwd,
      frozen,
      forcedTarget: "cursor",
      forceTarget: "cursor",
      integrationRegistry: registry,
      registry,
    });
  }

  test("materializes agent, instruction, and command via the Cursor adapter", async () => {
    writeSingleFileProject();

    await expect(install()).resolves.toMatchObject({ ok: true });

    expect(readFileSync(join(project.cwd, ".cursor/agents/scout.md"), "utf8")).toBe(AGENT);
    expect(readFileSync(join(project.cwd, ".cursor/rules/style.mdc"), "utf8")).toBe(INSTRUCTION);
    expect(readFileSync(join(project.cwd, ".cursor/commands/review.md"), "utf8")).toBe(PROMPT);

    const deps = loadLockfile({ cwd: project.cwd }).document.dependencies ?? [];
    for (const filename of ["scout.agent.md", "style.instructions.md", "review.prompt.md"]) {
      const row = deps.find((dep) => dep.name === filename) as Record<string, unknown>;
      expect(row).toMatchObject({
        repo_url: `local:ai/${filename}`,
        source: "local",
        path: `ai/${filename}`,
        local_path: `ai/${filename}`,
        package_type: "local",
        content_hash: computeLocalSourceContentHash(join(project.cwd, "ai", filename)),
      });
      expect(row.deployed_file_hashes).toBeTruthy();
    }

    const modules = join(project.cwd, "apm_modules");
    const snapshotFiles = readdirSync(modules)
      .filter((name) => name.startsWith("local_ai_"))
      .flatMap((name) => listFilesRecursive(join(modules, name)));
    for (const filename of ["scout.agent.md", "style.instructions.md", "review.prompt.md"]) {
      expect(snapshotFiles.some((rel) => rel.endsWith(filename))).toBe(true);
    }
  });

  test("frozen passes with a recorded snapshot and fails after file drift", async () => {
    writeSingleFileProject();
    await expect(install()).resolves.toMatchObject({ ok: true });
    await expect(install(true)).resolves.toMatchObject({ ok: true });

    writeFileSync(
      join(project.cwd, "ai/scout.agent.md"),
      "---\ndescription: Changed\n---\n# Changed\n",
    );

    const err = await expectRejectsMatching(() => install(true), /content changed|content_hash/i);
    expect((err as { code?: string }).code).toBe("INSTALL_FROZEN_UNDER_RECORDED");
    expect((err as { details?: { reason?: string } }).details?.reason).toBe(
      "local_content_changed",
    );
    // No harness rewrite under frozen drift.
    expect(existsSync(join(project.cwd, ".cursor/agents/scout.md"))).toBe(true);
    expect(readFileSync(join(project.cwd, ".cursor/agents/scout.md"), "utf8")).toBe(AGENT);
  });
});
