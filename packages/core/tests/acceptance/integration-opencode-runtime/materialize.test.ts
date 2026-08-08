/**
 * Materialize skills → .opencode/skills, agents → .opencode/agents; no MCP side effects.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createOpencodeTarget, createTempDir, type TempDir } from "./helpers.ts";

describe("integration-opencode-runtime · materialize", () => {
  let project: TempDir | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("skill appears under .opencode/skills/<name>/SKILL.md", async () => {
    project = createTempDir("bapm-acc-oc-skill-");
    mkdirSync(join(project.cwd, ".opencode"), { recursive: true });
    const srcDir = join(project.cwd, "src-skill");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "SKILL.md"), "---\nname: hello\n---\n# Hello\n", "utf8");

    const target = await createOpencodeTarget();
    await target.materialize(
      [{ name: "hello", type: "skill", source: "local", path: join(srcDir, "SKILL.md") }],
      { cwd: project.cwd, targetId: "opencode", deployRoots: target.deployRoots },
    );

    const dest = join(project.cwd, ".opencode", "skills", "hello", "SKILL.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toMatch(/Hello/);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(false);
    expect(existsSync(join(project.cwd, "opencode.json"))).toBe(false);
  });

  test("portable Agent Plugins skill directory is fully copied", async () => {
    project = createTempDir("bapm-acc-oc-portable-skill-");
    mkdirSync(join(project.cwd, ".opencode"), { recursive: true });
    const pluginRoot = join(project.cwd, "plugin");
    const skillDir = join(pluginRoot, "skills", "example");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: example\n---\n# Example\n", "utf8");
    writeFileSync(join(skillDir, "guide.md"), "auxiliary skill file\n", "utf8");

    const target = await createOpencodeTarget();
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
      { cwd: project.cwd, targetId: "opencode", deployRoots: target.deployRoots },
    );

    expect(
      readFileSync(join(project.cwd, ".opencode", "skills", "example", "guide.md"), "utf8"),
    ).toBe("auxiliary skill file\n");
    expect(existsSync(join(project.cwd, ".opencode", "skills", "example", "SKILL.md"))).toBe(true);
  });

  test("agent materializes to .opencode/agents/<name>.md without MCP writes", async () => {
    project = createTempDir("bapm-acc-oc-agent-");
    mkdirSync(join(project.cwd, ".opencode"), { recursive: true });
    const src = join(project.cwd, "agent.md");
    writeFileSync(src, "---\nname: scout\n---\n# Scout\n", "utf8");

    const target = await createOpencodeTarget();
    await target.materialize(
      [{ name: "scout", type: "agent", source: "local", path: src }],
      { cwd: project.cwd, targetId: "opencode", deployRoots: target.deployRoots },
    );

    const dest = join(project.cwd, ".opencode", "agents", "scout.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toMatch(/Scout/);
    expect(existsSync(join(project.cwd, "opencode.json"))).toBe(false);
  });

  test("forced target may create .opencode roots when absent", async () => {
    project = createTempDir("bapm-acc-oc-force-roots-");
    const srcDir = join(project.cwd, "src-skill");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "SKILL.md"), "---\nname: forced\n---\n# Forced\n", "utf8");

    const target = await createOpencodeTarget();
    expect(existsSync(join(project.cwd, ".opencode"))).toBe(false);

    await target.materialize(
      [{ name: "forced", type: "skill", source: "local", path: join(srcDir, "SKILL.md") }],
      { cwd: project.cwd, targetId: "opencode", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(project.cwd, ".opencode", "skills", "forced", "SKILL.md"))).toBe(true);
  });
});
