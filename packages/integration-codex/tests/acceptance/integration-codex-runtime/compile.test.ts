/**
 * compile → project-root AGENTS.md including instructions; honor write intent.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
// @ts-expect-error RED: createCodexIntegration lands in apply
import { createCodexIntegration } from "../../../src/createCodexIntegration.ts";
import { createTempProject, type TempProject } from "./helpers.ts";

describe("codex compile", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("compile writes AGENTS.md with deterministic content when write=true", async () => {
    project = createTempProject("bapm-codex-compile-write-");
    mkdirSync(join(project.cwd, ".codex"), { recursive: true });
    const skill = join(project.cwd, "skill.md");
    writeFileSync(skill, "---\nname: hello\n---\n# Hello skill\n", "utf8");

    const target = createCodexIntegration();
    const compile = target.compile;
    if (!compile) throw new Error("codex target must support compile");

    const first = await compile([{ name: "hello", type: "skill", source: "local", path: skill }], {
      cwd: project.cwd,
      write: true,
    });
    const second = await compile([{ name: "hello", type: "skill", source: "local", path: skill }], {
      cwd: project.cwd,
      write: true,
    });

    expect(first.path).toBe("AGENTS.md");
    expect(first.wrote).toBe(true);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(true);
    expect(first.content).toBe(second.content);
    expect(first.content.length).toBeGreaterThan(0);
  });

  test("instructions are included in AGENTS.md body", async () => {
    project = createTempProject("bapm-codex-compile-include-");
    const skill = join(project.cwd, "skill.md");
    const instr = join(project.cwd, "instr.md");
    writeFileSync(skill, "---\nname: skill-a\n---\n# Skill Alpha Unique\n", "utf8");
    writeFileSync(instr, "# Instruction Bravo Unique Marker\n", "utf8");

    const target = createCodexIntegration();
    const compile = target.compile;
    if (!compile) throw new Error("codex target must support compile");

    const report = await compile(
      [
        { name: "skill-a", type: "skill", source: "local", path: skill },
        { name: "instr-b", type: "instruction", source: "local", path: instr },
      ],
      { cwd: project.cwd, write: true },
    );

    expect(report.content).toMatch(/Skill Alpha Unique/);
    expect(report.content).toMatch(/Instruction Bravo Unique Marker/);
  });

  test("validate/preview does not write AGENTS.md when write=false", async () => {
    project = createTempProject("bapm-codex-compile-preview-");
    const skill = join(project.cwd, "skill.md");
    writeFileSync(skill, "---\nname: preview\n---\n# Preview\n", "utf8");

    const target = createCodexIntegration();
    const compile = target.compile;
    if (!compile) throw new Error("codex target must support compile");

    const preview = await compile(
      [{ name: "preview", type: "skill", source: "local", path: skill }],
      { cwd: project.cwd, write: false },
    );

    expect(preview.path).toBe("AGENTS.md");
    expect(preview.wrote).toBe(false);
    expect(preview.content.length).toBeGreaterThan(0);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });
});
