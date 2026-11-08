/**
 * Materialize: skills → .agents/skills/<name>/; other kinds skip with a warning.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  loadHermesIntegration,
  readUtf8,
  reportDiagnostics,
  writePrimitiveFile,
} from "./helpers.ts";

describe("hermes materialize", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("skill appears under .agents/skills/<name>/SKILL.md", async () => {
    const project = createTempProject("bapm-hermes-skill-");
    cleanup = project.cleanup;
    const srcDir = join(project.cwd, "src-skill");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "SKILL.md"), "---\nname: hello\n---\n# Hello\n", "utf8");

    const target = loadHermesIntegration();
    const report = await target.materialize(
      [{ name: "hello", type: "skill", source: "local", path: join(srcDir, "SKILL.md") }],
      { cwd: project.cwd, targetId: "hermes", deployRoots: target.deployRoots },
    );

    const dest = join(project.cwd, ".agents", "skills", "hello", "SKILL.md");
    expect(existsSync(dest)).toBe(true);
    expect(readUtf8(dest)).toMatch(/Hello/);
    expect(report?.deployedFiles?.some((f) => f.path === ".agents/skills/hello/SKILL.md")).toBe(
      true,
    );
  });

  test("portable Agent Plugins skill directory is fully copied", async () => {
    const project = createTempProject("bapm-hermes-portable-");
    cleanup = project.cleanup;
    const pluginRoot = join(project.cwd, "plugin");
    const skillDir = join(pluginRoot, "skills", "example");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: example\n---\n# Example\n", "utf8");
    writeFileSync(join(skillDir, "guide.md"), "auxiliary skill file\n", "utf8");

    const target = loadHermesIntegration();
    await target.materialize(
      [
        {
          name: "example",
          type: "skill",
          source: "local",
          path: join(skillDir, "SKILL.md"),
          format: "agent-plugin",
          skillDirectory: skillDir,
          pluginRoot,
        },
      ],
      { cwd: project.cwd, targetId: "hermes", deployRoots: target.deployRoots },
    );

    expect(readUtf8(join(project.cwd, ".agents", "skills", "example", "guide.md"))).toBe(
      "auxiliary skill file\n",
    );
  });

  test.each([
    { kind: "instruction", name: "style", file: "style.md", body: "# Style\n" },
    { kind: "agent", name: "scout", file: "scout.md", body: "---\nname: scout\n---\n# Scout\n" },
    { kind: "command", name: "review", file: "review.md", body: "# Review\n" },
    {
      kind: "hook",
      name: "on-stop",
      file: "hook.json",
      body: '{"hooks":{"Stop":[{"type":"command","command":"echo hi"}]}}\n',
    },
  ])("non-skill $kind skips with diagnostic", async ({ kind, name, file, body }) => {
    const project = createTempProject(`bapm-hermes-skip-${kind}-`);
    cleanup = project.cleanup;
    const src = writePrimitiveFile(project.cwd, file, body);

    const target = loadHermesIntegration();
    const report = await target.materialize([{ name, type: kind, source: "local", path: src }], {
      cwd: project.cwd,
      targetId: "hermes",
      deployRoots: target.deployRoots,
    });

    expect(
      reportDiagnostics(report).some(
        (d) => d.code === "HERMES_PRIMITIVE_UNSUPPORTED" && String(d.primitive).includes(name),
      ),
    ).toBe(true);
    expect(existsSync(join(project.cwd, ".agents", "skills", name))).toBe(false);
  });

  test("materialize rejects a missing .agents root", async () => {
    const project = createTempProject("bapm-hermes-bad-roots-");
    cleanup = project.cleanup;
    const src = writePrimitiveFile(project.cwd, "SKILL.md", "# Skill\n");

    const target = loadHermesIntegration();
    await expect(
      target.materialize([{ name: "bad", type: "skill", source: "local", path: src }], {
        cwd: project.cwd,
        targetId: "hermes",
        deployRoots: [".grok"],
      }),
    ).rejects.toThrow(/\.agents/);
  });
});
