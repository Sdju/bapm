/**
 * Thin compile → .github/copilot-instructions.md; omit deployed instructions;
 * honor write intent; no canvas.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, loadCopilotIntegration } from "./helpers.ts";

describe("copilot compile", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("compile writes .github/copilot-instructions.md when write=true", async () => {
    const project = createTempProject("bapm-copilot-compile-write-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".github"), { recursive: true });
    const skill = join(project.cwd, "skill.md");
    writeFileSync(skill, "---\nname: hello\n---\n# Hello skill\n", "utf8");

    const target = loadCopilotIntegration();
    const compile = target.compile;
    if (!compile) throw new Error("copilot target must support compile");

    const first = await compile([{ name: "hello", type: "skill", source: "local", path: skill }], {
      cwd: project.cwd,
      write: true,
    });
    const second = await compile([{ name: "hello", type: "skill", source: "local", path: skill }], {
      cwd: project.cwd,
      write: true,
    });

    expect(first.path).toBe(".github/copilot-instructions.md");
    expect(first.wrote).toBe(true);
    expect(existsSync(join(project.cwd, ".github", "copilot-instructions.md"))).toBe(true);
    expect(first.content).toBe(second.content);
    expect(first.content.length).toBeGreaterThan(0);
    expect(existsSync(join(project.cwd, ".github", "extensions"))).toBe(false);
  });

  test("deployed instruction primitives are omitted from compile body", async () => {
    const project = createTempProject("bapm-copilot-compile-omit-");
    cleanup = project.cleanup;
    const skill = join(project.cwd, "skill.md");
    const instr = join(project.cwd, "instr.md");
    writeFileSync(skill, "---\nname: skill-a\n---\n# Skill Alpha Unique\n", "utf8");
    writeFileSync(instr, "# Instruction Bravo Unique Marker\n", "utf8");

    const target = loadCopilotIntegration();
    const compile = target.compile;
    if (!compile) throw new Error("copilot target must support compile");

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

  test("validate/preview does not write when write=false", async () => {
    const project = createTempProject("bapm-copilot-compile-preview-");
    cleanup = project.cleanup;
    const skill = join(project.cwd, "skill.md");
    writeFileSync(skill, "---\nname: preview\n---\n# Preview\n", "utf8");

    const target = loadCopilotIntegration();
    const compile = target.compile;
    if (!compile) throw new Error("copilot target must support compile");

    const preview = await compile(
      [{ name: "preview", type: "skill", source: "local", path: skill }],
      { cwd: project.cwd, write: false },
    );

    expect(preview.path).toBe(".github/copilot-instructions.md");
    expect(preview.wrote).toBe(false);
    expect(preview.content.length).toBeGreaterThan(0);
    expect(existsSync(join(project.cwd, ".github", "copilot-instructions.md"))).toBe(false);
  });
});
