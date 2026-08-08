/**
 * Materialize: commands → `.gemini/commands/*.toml`, skills → `.agents/skills/`,
 * instructions compile-only (diagnostic), agents unsupported.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  loadGeminiIntegration,
  reportDiagnostics,
  writePrimitiveFile,
} from "./helpers.ts";

describe("gemini materialize", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("command becomes .gemini/commands/<name>.toml with {{args}}", async () => {
    const project = createTempProject("bapm-gemini-cmd-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".gemini"), { recursive: true });
    const src = writePrimitiveFile(
      project.cwd,
      "src/hello.prompt.md",
      "---\ndescription: Say hello\n---\nGreet $ARGUMENTS please.\n",
    );

    const target = loadGeminiIntegration();
    await target.materialize([{ name: "hello", type: "command", source: "local", path: src }], {
      cwd: project.cwd,
      targetId: "gemini",
      deployRoots: target.deployRoots,
    });

    const dest = join(project.cwd, ".gemini", "commands", "hello.toml");
    expect(existsSync(dest)).toBe(true);
    const raw = readFileSync(dest, "utf8");
    expect(raw).toMatch(/description\s*=\s*"Say hello"/);
    expect(raw).toMatch(/\{\{args\}\}/);
    expect(raw).not.toMatch(/\$ARGUMENTS/);
    expect(existsSync(join(project.cwd, ".gemini", "skills"))).toBe(false);
  });

  test("skill appears under .agents/skills and not .gemini/skills", async () => {
    const project = createTempProject("bapm-gemini-skill-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".gemini"), { recursive: true });
    const srcDir = join(project.cwd, "src-skill");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "SKILL.md"), "---\nname: hello\n---\n# Hello\n", "utf8");

    const target = loadGeminiIntegration();
    await target.materialize(
      [{ name: "hello", type: "skill", source: "local", path: join(srcDir, "SKILL.md") }],
      { cwd: project.cwd, targetId: "gemini", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(true);
    expect(existsSync(join(project.cwd, ".gemini", "skills", "hello", "SKILL.md"))).toBe(false);
  });

  test("portable Agent Plugins skill directory is fully copied", async () => {
    const project = createTempProject("bapm-gemini-portable-skill-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".gemini"), { recursive: true });
    const pluginRoot = join(project.cwd, "plugin");
    const skillDir = join(pluginRoot, "skills", "example");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: example\n---\n# Example\n", "utf8");
    writeFileSync(join(skillDir, "guide.md"), "auxiliary skill file\n", "utf8");

    const target = loadGeminiIntegration();
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
      { cwd: project.cwd, targetId: "gemini", deployRoots: target.deployRoots },
    );

    expect(
      readFileSync(join(project.cwd, ".agents", "skills", "example", "guide.md"), "utf8"),
    ).toBe("auxiliary skill file\n");
  });

  test("instruction is not materialized; diagnostic is compile-only", async () => {
    const project = createTempProject("bapm-gemini-instr-skip-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".gemini"), { recursive: true });
    const src = writePrimitiveFile(project.cwd, "src/rule.md", "# Rule body\n");

    const target = loadGeminiIntegration();
    const report = await target.materialize(
      [{ name: "rule", type: "instruction", source: "local", path: src }],
      { cwd: project.cwd, targetId: "gemini", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(project.cwd, ".gemini", "rules"))).toBe(false);
    const diags = reportDiagnostics(report);
    expect(
      diags.some(
        (d: { message: string }) => /instruction/i.test(d.message) || /compile/i.test(d.message),
      ),
    ).toBe(true);
  });

  test("forced gemini may create .gemini and .agents roots", async () => {
    const project = createTempProject("bapm-gemini-mkdir-");
    cleanup = project.cleanup;
    const src = writePrimitiveFile(
      project.cwd,
      "src/hi.prompt.md",
      "---\ndescription: Hi\n---\nHello\n",
    );

    const target = loadGeminiIntegration();
    await target.materialize([{ name: "hi", type: "command", source: "local", path: src }], {
      cwd: project.cwd,
      targetId: "gemini",
      deployRoots: target.deployRoots,
    });

    expect(existsSync(join(project.cwd, ".gemini", "commands", "hi.toml"))).toBe(true);
  });
});
