/**
 * Materialize skills → .opencode/skills, agents → .opencode/agents; no MCP side effects
 * (promoted from integration-opencode-runtime acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOpencodeIntegration } from "../src/index.ts";

describe("opencode materialize", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("skill appears under .opencode/skills/<name>/SKILL.md", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-oc-skill-"));
    mkdirSync(join(cwd, ".opencode"), { recursive: true });
    const srcDir = join(cwd, "src-skill");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "SKILL.md"), "---\nname: hello\n---\n# Hello\n", "utf8");

    const target = createOpencodeIntegration();
    await target.materialize(
      [{ name: "hello", type: "skill", source: "local", path: join(srcDir, "SKILL.md") }],
      { cwd, targetId: "opencode", deployRoots: target.deployRoots },
    );

    const dest = join(cwd, ".opencode", "skills", "hello", "SKILL.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toMatch(/Hello/);
    expect(existsSync(join(cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(false);
    expect(existsSync(join(cwd, "opencode.json"))).toBe(false);
  });

  test("portable Agent Plugins skill directory is fully copied", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-oc-portable-skill-"));
    mkdirSync(join(cwd, ".opencode"), { recursive: true });
    const pluginRoot = join(cwd, "plugin");
    const skillDir = join(pluginRoot, "skills", "example");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: example\n---\n# Example\n", "utf8");
    writeFileSync(join(skillDir, "guide.md"), "auxiliary skill file\n", "utf8");

    const target = createOpencodeIntegration();
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
      { cwd, targetId: "opencode", deployRoots: target.deployRoots },
    );

    expect(readFileSync(join(cwd, ".opencode", "skills", "example", "guide.md"), "utf8")).toBe(
      "auxiliary skill file\n",
    );
    expect(existsSync(join(cwd, ".opencode", "skills", "example", "SKILL.md"))).toBe(true);
  });

  test("agent materializes to .opencode/agents/<name>.md without MCP writes", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-oc-agent-"));
    mkdirSync(join(cwd, ".opencode"), { recursive: true });
    const src = join(cwd, "agent.md");
    writeFileSync(src, "---\nname: scout\n---\n# Scout\n", "utf8");

    const target = createOpencodeIntegration();
    await target.materialize([{ name: "scout", type: "agent", source: "local", path: src }], {
      cwd,
      targetId: "opencode",
      deployRoots: target.deployRoots,
    });

    const dest = join(cwd, ".opencode", "agents", "scout.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toMatch(/Scout/);
    expect(existsSync(join(cwd, "opencode.json"))).toBe(false);
  });

  test("forced target may create .opencode roots when absent", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-oc-force-roots-"));
    const srcDir = join(cwd, "src-skill");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "SKILL.md"), "---\nname: forced\n---\n# Forced\n", "utf8");

    const target = createOpencodeIntegration();
    expect(existsSync(join(cwd, ".opencode"))).toBe(false);

    await target.materialize(
      [{ name: "forced", type: "skill", source: "local", path: join(srcDir, "SKILL.md") }],
      { cwd, targetId: "opencode", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(cwd, ".opencode", "skills", "forced", "SKILL.md"))).toBe(true);
  });
});
