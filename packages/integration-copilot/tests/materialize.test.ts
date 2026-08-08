/**
 * Materialize: instructions/prompts/agents under .github; skills under .agents;
 * deploy-root containment; forced mkdir; no canvas / commands / github skills.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  loadCopilotIntegration,
  reportDiagnostics,
  writePrimitiveFile,
} from "./helpers.ts";

describe("copilot materialize", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("instruction becomes .github/instructions/<name>.instructions.md preserving applyTo", async () => {
    const project = createTempProject("bapm-copilot-instr-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".github"), { recursive: true });
    const src = writePrimitiveFile(
      project.cwd,
      "style.md",
      '---\napplyTo:\n  - "**/*.ts"\n---\n# Style rule\n',
    );

    const target = loadCopilotIntegration();
    await target.materialize([{ name: "style", type: "instruction", source: "local", path: src }], {
      cwd: project.cwd,
      targetId: "copilot",
      deployRoots: target.deployRoots,
    });

    const dest = join(project.cwd, ".github", "instructions", "style.instructions.md");
    expect(existsSync(dest)).toBe(true);
    const body = readFileSync(dest, "utf8");
    expect(body).toMatch(/Style rule/);
    expect(body).toMatch(/applyTo/);
    expect(body).toMatch(/\*\*\/\*\.ts/);
    expect(existsSync(join(project.cwd, ".vscode", "mcp.json"))).toBe(false);
    expect(existsSync(join(project.cwd, ".mcp.json"))).toBe(false);
  });

  test("command from *.prompt.md lands under prompts not commands", async () => {
    const project = createTempProject("bapm-copilot-prompt-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".github"), { recursive: true });
    const src = writePrimitiveFile(
      project.cwd,
      "review.prompt.md",
      "---\ndescription: review\n---\n# Review prompt\n",
    );

    const target = loadCopilotIntegration();
    await target.materialize([{ name: "review", type: "command", source: "local", path: src }], {
      cwd: project.cwd,
      targetId: "copilot",
      deployRoots: target.deployRoots,
    });

    const dest = join(project.cwd, ".github", "prompts", "review.prompt.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toMatch(/Review prompt/);
    expect(existsSync(join(project.cwd, ".github", "commands", "review.prompt.md"))).toBe(false);
    expect(existsSync(join(project.cwd, ".github", "commands", "review.md"))).toBe(false);
    expect(existsSync(join(project.cwd, ".cursor", "commands", "review.md"))).toBe(false);
  });

  test("agent becomes .github/agents/<name>.agent.md without MCP side effects", async () => {
    const project = createTempProject("bapm-copilot-agent-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".github"), { recursive: true });
    const src = writePrimitiveFile(project.cwd, "scout.md", "---\nname: scout\n---\n# Scout\n");

    const target = loadCopilotIntegration();
    await target.materialize([{ name: "scout", type: "agent", source: "local", path: src }], {
      cwd: project.cwd,
      targetId: "copilot",
      deployRoots: target.deployRoots,
    });

    expect(existsSync(join(project.cwd, ".github", "agents", "scout.agent.md"))).toBe(true);
    expect(readFileSync(join(project.cwd, ".github", "agents", "scout.agent.md"), "utf8")).toMatch(
      /Scout/,
    );
    expect(existsSync(join(project.cwd, ".vscode", "mcp.json"))).toBe(false);
  });

  test("skill appears under .agents/skills and not .github/skills", async () => {
    const project = createTempProject("bapm-copilot-skill-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".github"), { recursive: true });
    const srcDir = join(project.cwd, "src-skill");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "SKILL.md"), "---\nname: hello\n---\n# Hello\n", "utf8");

    const target = loadCopilotIntegration();
    await target.materialize(
      [{ name: "hello", type: "skill", source: "local", path: join(srcDir, "SKILL.md") }],
      { cwd: project.cwd, targetId: "copilot", deployRoots: target.deployRoots },
    );

    const dest = join(project.cwd, ".agents", "skills", "hello", "SKILL.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toMatch(/Hello/);
    expect(existsSync(join(project.cwd, ".github", "skills", "hello", "SKILL.md"))).toBe(false);
    expect(existsSync(join(project.cwd, ".vscode", "mcp.json"))).toBe(false);
  });

  test("portable Agent Plugins skill directory is fully copied", async () => {
    const project = createTempProject("bapm-copilot-portable-skill-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".github"), { recursive: true });
    const pluginRoot = join(project.cwd, "plugin");
    const skillDir = join(pluginRoot, "skills", "example");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: example\n---\n# Example\n", "utf8");
    writeFileSync(join(skillDir, "guide.md"), "auxiliary skill file\n", "utf8");

    const target = loadCopilotIntegration();
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
      { cwd: project.cwd, targetId: "copilot", deployRoots: target.deployRoots },
    );

    expect(
      readFileSync(join(project.cwd, ".agents", "skills", "example", "guide.md"), "utf8"),
    ).toBe("auxiliary skill file\n");
    expect(existsSync(join(project.cwd, ".agents", "skills", "example", "SKILL.md"))).toBe(true);
    expect(existsSync(join(project.cwd, ".github", "skills", "example", "SKILL.md"))).toBe(false);
  });

  test("materialize refuses escapes outside deploy roots", async () => {
    const project = createTempProject("bapm-copilot-escape-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".github"), { recursive: true });
    const srcDir = join(project.cwd, "src-skill");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "SKILL.md"), "---\nname: escape\n---\n# Escape\n", "utf8");

    const target = loadCopilotIntegration();
    await expect(
      target.materialize(
        [{ name: "escape", type: "skill", source: "local", path: join(srcDir, "SKILL.md") }],
        { cwd: project.cwd, targetId: "copilot", deployRoots: [".github"] },
      ),
    ).rejects.toThrow();
    expect(existsSync(join(project.cwd, ".agents", "skills", "escape", "SKILL.md"))).toBe(false);
  });

  test("forced copilot creates deploy roots when absent", async () => {
    const project = createTempProject("bapm-copilot-force-roots-");
    cleanup = project.cleanup;
    expect(existsSync(join(project.cwd, ".github"))).toBe(false);
    expect(existsSync(join(project.cwd, ".agents"))).toBe(false);

    const srcDir = join(project.cwd, "src-skill");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "SKILL.md"), "---\nname: forced\n---\n# Forced\n", "utf8");

    const target = loadCopilotIntegration();
    await target.materialize(
      [{ name: "forced", type: "skill", source: "local", path: join(srcDir, "SKILL.md") }],
      { cwd: project.cwd, targetId: "copilot", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(project.cwd, ".agents", "skills", "forced", "SKILL.md"))).toBe(true);
  });

  test("canvas / extensions paths are not created by supported materialize", async () => {
    const project = createTempProject("bapm-copilot-no-canvas-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".github"), { recursive: true });
    const src = writePrimitiveFile(project.cwd, "note.md", "# Note\n");

    const target = loadCopilotIntegration();
    const report = await target.materialize(
      [{ name: "note", type: "instruction", source: "local", path: src }],
      { cwd: project.cwd, targetId: "copilot", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(project.cwd, ".github", "extensions"))).toBe(false);
    expect(existsSync(join(project.cwd, ".github", "instructions", "note.instructions.md"))).toBe(
      true,
    );
    // materialize of supported kinds should not invent canvas diagnostics as success path
    void reportDiagnostics(report);
  });
});
