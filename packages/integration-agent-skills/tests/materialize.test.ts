/**
 * Materialize: skills → .agents/skills/; non-skills skip with diagnostics;
 * portable Agent Plugins copy; no MCP/hooks/compile side effects
 * .
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  loadAgentSkillsIntegration,
  readUtf8,
  reportDiagnostics,
  writePrimitiveFile,
} from "./helpers.ts";

describe("agent-skills materialize", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("skill appears under .agents/skills/<name>/SKILL.md without MCP side effects", async () => {
    const project = createTempProject("bapm-agent-skills-skill-");
    cleanup = project.cleanup;
    const srcDir = join(project.cwd, "src-skill");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "SKILL.md"), "---\nname: hello\n---\n# Hello\n", "utf8");

    const target = loadAgentSkillsIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);

    await target.materialize(
      [{ name: "hello", type: "skill", source: "local", path: join(srcDir, "SKILL.md") }],
      { cwd: project.cwd, targetId: "agent-skills", deployRoots: target.deployRoots },
    );

    const dest = join(project.cwd, ".agents", "skills", "hello", "SKILL.md");
    expect(existsSync(dest)).toBe(true);
    expect(readUtf8(dest)).toMatch(/Hello/);
    expect(existsSync(join(project.cwd, ".mcp.json"))).toBe(false);
    expect(existsSync(join(project.cwd, ".agents", "hooks.json"))).toBe(false);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });

  test("portable Agent Plugins skill directory is fully copied", async () => {
    const project = createTempProject("bapm-agent-skills-portable-");
    cleanup = project.cleanup;
    const pluginRoot = join(project.cwd, "plugin");
    const skillDir = join(pluginRoot, "skills", "example");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: example\n---\n# Example\n", "utf8");
    writeFileSync(join(skillDir, "guide.md"), "auxiliary skill file\n", "utf8");

    const target = loadAgentSkillsIntegration();
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
      { cwd: project.cwd, targetId: "agent-skills", deployRoots: target.deployRoots },
    );

    expect(readUtf8(join(project.cwd, ".agents", "skills", "example", "guide.md"))).toBe(
      "auxiliary skill file\n",
    );
    expect(existsSync(join(project.cwd, ".agents", "skills", "example", "SKILL.md"))).toBe(true);
  });

  test("explicit activation path: materialize works while detect stays false", async () => {
    const project = createTempProject("bapm-agent-skills-forced-");
    cleanup = project.cleanup;
    const srcDir = join(project.cwd, "src-skill");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "SKILL.md"), "---\nname: forced\n---\n# Forced\n", "utf8");

    const target = loadAgentSkillsIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);

    await target.materialize(
      [{ name: "forced", type: "skill", source: "local", path: join(srcDir, "SKILL.md") }],
      { cwd: project.cwd, targetId: "agent-skills", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(project.cwd, ".agents", "skills", "forced", "SKILL.md"))).toBe(true);
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
  });

  test.each([
    { kind: "instruction", name: "style", file: "style.md", body: "# Style\n" },
    { kind: "agent", name: "scout", file: "scout.md", body: "---\nname: scout\n---\n# Scout\n" },
    { kind: "command", name: "review", file: "review.md", body: "# Review\n" },
    { kind: "prompt", name: "ask", file: "ask.prompt.md", body: "# Ask\n" },
    {
      kind: "hook",
      name: "on-stop",
      file: "hook.json",
      body: '{"hooks":{"Stop":[{"type":"command","command":"echo hi"}]}}\n',
    },
  ])("non-skill $kind skips host files with diagnostic", async ({ kind, name, file, body }) => {
    const project = createTempProject(`bapm-agent-skills-skip-${kind}-`);
    cleanup = project.cleanup;
    const src = writePrimitiveFile(project.cwd, file, body);

    const target = loadAgentSkillsIntegration();
    const report = await target.materialize([{ name, type: kind, source: "local", path: src }], {
      cwd: project.cwd,
      targetId: "agent-skills",
      deployRoots: target.deployRoots,
    });

    const diagnostics = reportDiagnostics(report);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(
      diagnostics.some((d) => {
        const primitive = typeof d.primitive === "string" ? d.primitive : "";
        return /skill/i.test(d.message) && (d.message.includes(name) || primitive.includes(name));
      }),
    ).toBe(true);

    expect(existsSync(join(project.cwd, ".agents", "skills", name))).toBe(false);
    expect(existsSync(join(project.cwd, ".agents", "hooks.json"))).toBe(false);
    expect(existsSync(join(project.cwd, ".agents", "agents"))).toBe(false);
    expect(existsSync(join(project.cwd, ".agents", "commands"))).toBe(false);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });
});
