/**
 * compile → CLAUDE.md; omit instructions; honor write intent.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClaudeTarget, createTempDir, type TempDir } from "./helpers.ts";

describe("integration-claude-runtime · compile", () => {
  let project: TempDir | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("compile writes CLAUDE.md with deterministic content when write=true", async () => {
    project = createTempDir("bapm-acc-claude-compile-write-");
    mkdirSync(join(project.cwd, ".claude"), { recursive: true });
    const skill = join(project.cwd, "skill.md");
    writeFileSync(skill, "---\nname: hello\n---\n# Hello skill\n", "utf8");

    const target = await createClaudeTarget();
    const compile = target.compile;
    if (!compile) throw new Error("claude target must support compile");

    const first = await compile([{ name: "hello", type: "skill", source: "local", path: skill }], {
      cwd: project.cwd,
      write: true,
    });
    const second = await compile([{ name: "hello", type: "skill", source: "local", path: skill }], {
      cwd: project.cwd,
      write: true,
    });

    expect(first.path).toBe("CLAUDE.md");
    expect(first.wrote).toBe(true);
    expect(existsSync(join(project.cwd, "CLAUDE.md"))).toBe(true);
    expect(first.content).toBe(second.content);
    expect(first.content.length).toBeGreaterThan(0);
  });

  test("instructions are omitted from CLAUDE.md body", async () => {
    project = createTempDir("bapm-acc-claude-compile-omit-");
    const skill = join(project.cwd, "skill.md");
    const instr = join(project.cwd, "instr.md");
    writeFileSync(skill, "---\nname: skill-a\n---\n# Skill Alpha Unique\n", "utf8");
    writeFileSync(instr, "# Instruction Bravo Unique Marker\n", "utf8");

    const target = await createClaudeTarget();
    const compile = target.compile;
    if (!compile) throw new Error("claude target must support compile");

    const report = await compile(
      [
        { name: "skill-a", type: "skill", source: "local", path: skill },
        { name: "instr-b", type: "instruction", source: "local", path: instr },
      ],
      { cwd: project.cwd, write: true },
    );

    expect(report.content).toMatch(/Skill Alpha Unique/);
    expect(report.content).not.toMatch(/Instruction Bravo Unique Marker/);
  });

  test("validate/preview does not write CLAUDE.md when write=false", async () => {
    project = createTempDir("bapm-acc-claude-compile-preview-");
    const skill = join(project.cwd, "skill.md");
    writeFileSync(skill, "---\nname: preview\n---\n# Preview\n", "utf8");

    const target = await createClaudeTarget();
    const compile = target.compile;
    if (!compile) throw new Error("claude target must support compile");

    const preview = await compile(
      [{ name: "preview", type: "skill", source: "local", path: skill }],
      { cwd: project.cwd, write: false },
    );

    expect(preview.path).toBe("CLAUDE.md");
    expect(preview.wrote).toBe(false);
    expect(preview.content.length).toBeGreaterThan(0);
    expect(existsSync(join(project.cwd, "CLAUDE.md"))).toBe(false);
  });
});
