/**
 * compile → project-root GEMINI.md with instructions only; honor write intent.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, loadGeminiIntegration } from "./helpers.ts";

describe("gemini compile", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("compile writes GEMINI.md with instruction content when write=true", async () => {
    const project = createTempProject("bapm-gemini-compile-write-");
    cleanup = project.cleanup;
    const instr = join(project.cwd, "instr.md");
    writeFileSync(instr, "# Instruction Bravo Unique Marker\n", "utf8");

    const target = loadGeminiIntegration();
    const compile = target.compile;
    if (!compile) throw new Error("gemini target must support compile");

    const report = await compile(
      [{ name: "instr-b", type: "instruction", source: "local", path: instr }],
      { cwd: project.cwd, write: true },
    );

    expect(report.path).toBe("GEMINI.md");
    expect(report.wrote).toBe(true);
    expect(existsSync(join(project.cwd, "GEMINI.md"))).toBe(true);
    expect(report.content).toMatch(/Instruction Bravo Unique Marker/);
  });

  test("non-instructions are omitted from GEMINI.md body", async () => {
    const project = createTempProject("bapm-gemini-compile-omit-");
    cleanup = project.cleanup;
    const skill = join(project.cwd, "skill.md");
    const instr = join(project.cwd, "instr.md");
    writeFileSync(skill, "---\nname: skill-a\n---\n# Skill Alpha Unique\n", "utf8");
    writeFileSync(instr, "# Instruction Only Marker\n", "utf8");

    const target = loadGeminiIntegration();
    const compile = target.compile;
    if (!compile) throw new Error("gemini target must support compile");

    const report = await compile(
      [
        { name: "skill-a", type: "skill", source: "local", path: skill },
        { name: "instr-b", type: "instruction", source: "local", path: instr },
      ],
      { cwd: project.cwd, write: true },
    );

    expect(report.content).toMatch(/Instruction Only Marker/);
    expect(report.content).not.toMatch(/Skill Alpha Unique/);
  });

  test("validate/preview does not write GEMINI.md when write=false", async () => {
    const project = createTempProject("bapm-gemini-compile-preview-");
    cleanup = project.cleanup;
    const instr = join(project.cwd, "instr.md");
    writeFileSync(instr, "# Preview instruction\n", "utf8");

    const target = loadGeminiIntegration();
    const compile = target.compile;
    if (!compile) throw new Error("gemini target must support compile");

    const preview = await compile(
      [{ name: "preview", type: "instruction", source: "local", path: instr }],
      { cwd: project.cwd, write: false },
    );

    expect(preview.wrote).toBe(false);
    expect(existsSync(join(project.cwd, "GEMINI.md"))).toBe(false);
    expect(preview.content.length).toBeGreaterThan(0);
  });
});
