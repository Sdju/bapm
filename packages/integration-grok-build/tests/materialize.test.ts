/**
 * Materialize under .grok/: skills, rules, agents, commands; skip hooks/prompts.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGrokBuildIntegration } from "../src/createGrokBuildIntegration.ts";

describe("grok-build materialize", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("skill appears under .grok/skills/<name>/SKILL.md and not .agents/skills", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-grok-u-skill-"));
    mkdirSync(join(cwd, ".grok"), { recursive: true });
    const srcDir = join(cwd, "src-skill");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "SKILL.md"), "---\nname: hello\n---\n# Hello\n", "utf8");

    const target = createGrokBuildIntegration();
    await target.materialize(
      [{ name: "hello", type: "skill", source: "local", path: join(srcDir, "SKILL.md") }],
      { cwd, targetId: "grok-build", deployRoots: target.deployRoots },
    );

    const dest = join(cwd, ".grok", "skills", "hello", "SKILL.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toMatch(/Hello/);
    expect(existsSync(join(cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(false);
  });

  test("portable Agent Plugins skill directory is fully copied", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-grok-u-portable-skill-"));
    mkdirSync(join(cwd, ".grok"), { recursive: true });
    const pluginRoot = join(cwd, "plugin");
    const skillDir = join(pluginRoot, "skills", "example");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: example\n---\n# Example\n", "utf8");
    writeFileSync(join(skillDir, "guide.md"), "auxiliary skill file\n", "utf8");

    const target = createGrokBuildIntegration();
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
      { cwd, targetId: "grok-build", deployRoots: target.deployRoots },
    );

    expect(readFileSync(join(cwd, ".grok", "skills", "example", "guide.md"), "utf8")).toBe(
      "auxiliary skill file\n",
    );
    expect(existsSync(join(cwd, ".grok", "skills", "example", "SKILL.md"))).toBe(true);
  });

  test("instruction becomes .grok/rules/<name>.md verbatim", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-grok-u-rules-"));
    mkdirSync(join(cwd, ".grok"), { recursive: true });
    const src = join(cwd, "style.md");
    writeFileSync(src, '---\napplyTo:\n  - "**/*.ts"\n---\n# Style rule\n', "utf8");

    const target = createGrokBuildIntegration();
    const report = await target.materialize(
      [{ name: "style", type: "instruction", source: "local", path: src }],
      { cwd, targetId: "grok-build", deployRoots: target.deployRoots },
    );

    const dest = join(cwd, ".grok", "rules", "style.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toMatch(/applyTo/);
    expect(report?.deployedFiles?.some((f) => f.path === ".grok/rules/style.md")).toBe(true);
  });

  test("agent becomes .grok/agents/<name>.md", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-grok-u-agent-"));
    mkdirSync(join(cwd, ".grok"), { recursive: true });
    const src = join(cwd, "reviewer.md");
    writeFileSync(src, "---\nname: reviewer\n---\n# Reviewer agent\n", "utf8");

    const target = createGrokBuildIntegration();
    await target.materialize([{ name: "reviewer", type: "agent", source: "local", path: src }], {
      cwd,
      targetId: "grok-build",
      deployRoots: target.deployRoots,
    });

    expect(existsSync(join(cwd, ".grok", "agents", "reviewer.md"))).toBe(true);
    expect(readFileSync(join(cwd, ".grok", "agents", "reviewer.md"), "utf8")).toMatch(
      /Reviewer agent/,
    );
  });

  test("command becomes .grok/commands/<name>.md with preserved FM subset", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-grok-u-command-"));
    mkdirSync(join(cwd, ".grok"), { recursive: true });
    const src = join(cwd, "ship.md");
    writeFileSync(
      src,
      "---\ndescription: Ship it\nmodel: gpt\ncustom-key: drop-me\n---\n# Ship\n",
      "utf8",
    );

    const target = createGrokBuildIntegration();
    const report = await target.materialize(
      [{ name: "ship", type: "command", source: "local", path: src }],
      { cwd, targetId: "grok-build", deployRoots: target.deployRoots },
    );

    const body = readFileSync(join(cwd, ".grok", "commands", "ship.md"), "utf8");
    expect(body).toMatch(/description:\s*Ship it/);
    expect(body).not.toMatch(/custom-key/);
    expect(
      report?.diagnostics?.some((d) => d.code === "GROK_BUILD_COMMAND_FRONTMATTER_DROPPED"),
    ).toBe(true);
  });

  test("hooks and prompts skip with diagnostics", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-grok-u-skip-"));
    mkdirSync(join(cwd, ".grok"), { recursive: true });
    const hook = join(cwd, "hook.json");
    const prompt = join(cwd, "ask.prompt.md");
    writeFileSync(hook, '{"hooks":{}}\n', "utf8");
    writeFileSync(prompt, "# Ask\n", "utf8");

    const target = createGrokBuildIntegration();
    const report = await target.materialize(
      [
        { name: "on-save", type: "hook", source: "local", path: hook },
        { name: "ask", type: "prompt", source: "local", path: prompt },
      ],
      { cwd, targetId: "grok-build", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(cwd, ".grok", "hooks.json"))).toBe(false);
    expect(report?.diagnostics?.some((d) => d.code === "GROK_BUILD_HOOKS_UNSUPPORTED")).toBe(true);
    expect(report?.diagnostics?.some((d) => d.code === "GROK_BUILD_PROMPTS_UNSUPPORTED")).toBe(
      true,
    );
  });

  test("forced materialize may create .grok when absent", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-grok-u-forced-mkdir-"));
    const src = join(cwd, "rule.md");
    writeFileSync(src, "# Forced rule\n", "utf8");
    expect(existsSync(join(cwd, ".grok"))).toBe(false);

    const target = createGrokBuildIntegration();
    await target.materialize(
      [{ name: "forced", type: "instruction", source: "local", path: src }],
      {
        cwd,
        targetId: "grok-build",
        deployRoots: target.deployRoots,
      },
    );

    expect(existsSync(join(cwd, ".grok", "rules", "forced.md"))).toBe(true);
  });
});
