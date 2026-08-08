/**
 * Materialize under .claude/: skills (not .agents/skills), rules, agents, commands
 * (promoted from integration-claude-runtime acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClaudeIntegration } from "../src/createClaudeIntegration.ts";

describe("claude materialize", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("skill appears under .claude/skills/<name>/SKILL.md and not .agents/skills", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-skill-"));
    mkdirSync(join(cwd, ".claude"), { recursive: true });
    const srcDir = join(cwd, "src-skill");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "SKILL.md"), "---\nname: hello\n---\n# Hello\n", "utf8");

    const target = createClaudeIntegration();
    await target.materialize(
      [{ name: "hello", type: "skill", source: "local", path: join(srcDir, "SKILL.md") }],
      { cwd, targetId: "claude", deployRoots: target.deployRoots },
    );

    const dest = join(cwd, ".claude", "skills", "hello", "SKILL.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toMatch(/Hello/);
    expect(existsSync(join(cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(false);
    expect(existsSync(join(cwd, ".mcp.json"))).toBe(false);
  });

  test("portable Agent Plugins skill directory is fully copied", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-portable-skill-"));
    mkdirSync(join(cwd, ".claude"), { recursive: true });
    const pluginRoot = join(cwd, "plugin");
    const skillDir = join(pluginRoot, "skills", "example");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: example\n---\n# Example\n", "utf8");
    writeFileSync(join(skillDir, "guide.md"), "auxiliary skill file\n", "utf8");

    const target = createClaudeIntegration();
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
      { cwd, targetId: "claude", deployRoots: target.deployRoots },
    );

    expect(readFileSync(join(cwd, ".claude", "skills", "example", "guide.md"), "utf8")).toBe(
      "auxiliary skill file\n",
    );
    expect(existsSync(join(cwd, ".claude", "skills", "example", "SKILL.md"))).toBe(true);
    expect(existsSync(join(cwd, ".agents", "skills", "example", "SKILL.md"))).toBe(false);
  });

  test("path-scoped instruction becomes .claude/rules/<name>.md with paths frontmatter", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-rules-paths-"));
    mkdirSync(join(cwd, ".claude"), { recursive: true });
    const src = join(cwd, "style.md");
    writeFileSync(
      src,
      '---\napplyTo:\n  - "**/*.ts"\n  - "src/**/*.tsx"\n---\n# Style rule\n',
      "utf8",
    );

    const target = createClaudeIntegration();
    await target.materialize([{ name: "style", type: "instruction", source: "local", path: src }], {
      cwd,
      targetId: "claude",
      deployRoots: target.deployRoots,
    });

    const dest = join(cwd, ".claude", "rules", "style.md");
    expect(existsSync(dest)).toBe(true);
    const body = readFileSync(dest, "utf8");
    expect(body).toMatch(/Style rule/);
    expect(body).toMatch(/^paths:\s*$/m);
    expect(body).toMatch(/\*\*\/\*\.ts/);
    expect(existsSync(join(cwd, ".claude", "rules", "style.mdc"))).toBe(false);
  });

  test("unconditional instruction omits paths frontmatter key", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-rules-uncond-"));
    mkdirSync(join(cwd, ".claude"), { recursive: true });
    const src = join(cwd, "general.md");
    writeFileSync(src, "# General guidance\n", "utf8");

    const target = createClaudeIntegration();
    await target.materialize(
      [{ name: "general", type: "instruction", source: "local", path: src }],
      { cwd, targetId: "claude", deployRoots: target.deployRoots },
    );

    const dest = join(cwd, ".claude", "rules", "general.md");
    expect(existsSync(dest)).toBe(true);
    const body = readFileSync(dest, "utf8");
    expect(body).toMatch(/General guidance/);
    expect(body).not.toMatch(/^paths:/m);
  });

  test("agent and command materialize under .claude without MCP side effects", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-agent-cmd-"));
    mkdirSync(join(cwd, ".claude"), { recursive: true });
    const agentSrc = join(cwd, "scout.md");
    writeFileSync(agentSrc, "---\nname: scout\n---\n# Scout\n", "utf8");
    const cmdSrc = join(cwd, "review.md");
    writeFileSync(
      cmdSrc,
      "---\ndescription: review\nallowed-tools: Read\nauthor: drop-me\n---\n# Review\n",
      "utf8",
    );

    const target = createClaudeIntegration();
    const report = await target.materialize(
      [
        { name: "scout", type: "agent", source: "local", path: agentSrc },
        { name: "review", type: "command", source: "local", path: cmdSrc },
      ],
      { cwd, targetId: "claude", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(cwd, ".claude", "agents", "scout.md"))).toBe(true);
    const cmdDest = join(cwd, ".claude", "commands", "review.md");
    expect(existsSync(cmdDest)).toBe(true);
    const cmdBody = readFileSync(cmdDest, "utf8");
    expect(cmdBody).toMatch(/description:\s*review/);
    expect(cmdBody).not.toMatch(/^author:/m);
    expect(existsSync(join(cwd, ".mcp.json"))).toBe(false);

    const diags =
      report && typeof report === "object" && "diagnostics" in report
        ? ((report as { diagnostics?: unknown[] }).diagnostics ?? [])
        : [];
    expect(diags.length).toBeGreaterThan(0);
  });

  test("forced target may create .claude roots when absent", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-force-roots-"));
    const srcDir = join(cwd, "src-skill");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "SKILL.md"), "---\nname: forced\n---\n# Forced\n", "utf8");

    const target = createClaudeIntegration();
    expect(existsSync(join(cwd, ".claude"))).toBe(false);

    await target.materialize(
      [{ name: "forced", type: "skill", source: "local", path: join(srcDir, "SKILL.md") }],
      { cwd, targetId: "claude", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(cwd, ".claude", "skills", "forced", "SKILL.md"))).toBe(true);
  });
});
