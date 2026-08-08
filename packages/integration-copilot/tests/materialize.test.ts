import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCopilotIntegration } from "../src/index.ts";

describe("createCopilotIntegration materialize", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  function temp(): string {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-copilot-unit-mat-"));
    cleanup = () => rmSync(cwd, { recursive: true, force: true });
    return cwd;
  }

  test("routes instruction / command / agent / skill kinds", async () => {
    const cwd = temp();
    mkdirSync(join(cwd, ".github"), { recursive: true });
    const instr = join(cwd, "style.md");
    writeFileSync(instr, '---\napplyTo:\n  - "**/*.ts"\n---\n# Style\n', "utf8");
    const prompt = join(cwd, "review.prompt.md");
    writeFileSync(prompt, "# Review\n", "utf8");
    const agent = join(cwd, "scout.md");
    writeFileSync(agent, "# Scout\n", "utf8");
    const skillDir = join(cwd, "skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "# Hello\n", "utf8");

    const target = createCopilotIntegration();
    const ctx = { cwd, targetId: "copilot", deployRoots: target.deployRoots };
    await target.materialize(
      [
        { name: "style", type: "instruction", source: "local", path: instr },
        { name: "review", type: "command", source: "local", path: prompt },
        { name: "scout", type: "agent", source: "local", path: agent },
        { name: "hello", type: "skill", source: "local", path: join(skillDir, "SKILL.md") },
      ],
      ctx,
    );

    expect(readFileSync(join(cwd, ".github/instructions/style.instructions.md"), "utf8")).toMatch(
      /applyTo/,
    );
    expect(existsSync(join(cwd, ".github/prompts/review.prompt.md"))).toBe(true);
    expect(existsSync(join(cwd, ".github/commands"))).toBe(false);
    expect(existsSync(join(cwd, ".github/agents/scout.agent.md"))).toBe(true);
    expect(existsSync(join(cwd, ".agents/skills/hello/SKILL.md"))).toBe(true);
    expect(existsSync(join(cwd, ".github/skills"))).toBe(false);
  });

  test("refuses skill write when .agents is not a deploy root", async () => {
    const cwd = temp();
    const skillDir = join(cwd, "skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "# Escape\n", "utf8");
    const target = createCopilotIntegration();
    await expect(
      target.materialize(
        [{ name: "escape", type: "skill", source: "local", path: join(skillDir, "SKILL.md") }],
        { cwd, targetId: "copilot", deployRoots: [".github"] },
      ),
    ).rejects.toThrow();
  });
});
