/**
 * Thin compile → AGENTS.md; omit instruction primitives deployed as rules.
 * (promoted from integration-antigravity-runtime acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, loadAntigravityIntegration } from "./helpers.ts";

describe("antigravity compile", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("compile writes AGENTS.md when write=true", async () => {
    const project = createTempProject("bapm-agy-compile-write-");
    cleanup = project.cleanup;
    const skill = join(project.cwd, "skill.md");
    writeFileSync(skill, "---\nname: hello\n---\n# Hello skill UniqueAgy\n", "utf8");

    const target = loadAntigravityIntegration();
    const compile = target.compile;
    if (!compile) throw new Error("antigravity target must support compile");

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
    expect(first.content).toMatch(/Hello skill UniqueAgy/);
  });

  test("deployed instruction primitives are omitted from compile body", async () => {
    const project = createTempProject("bapm-agy-compile-omit-");
    cleanup = project.cleanup;
    const skill = join(project.cwd, "skill.md");
    const instr = join(project.cwd, "instr.md");
    writeFileSync(skill, "---\nname: skill-a\n---\n# Skill Alpha UniqueAgy\n", "utf8");
    writeFileSync(instr, "# Instruction Bravo UniqueAgy Marker\n", "utf8");

    const target = loadAntigravityIntegration();
    const compile = target.compile;
    if (!compile) throw new Error("antigravity target must support compile");

    const report = await compile(
      [
        { name: "skill-a", type: "skill", source: "local", path: skill },
        { name: "instr-b", type: "instruction", source: "local", path: instr },
      ],
      { cwd: project.cwd, write: true },
    );

    expect(report.content).toMatch(/Skill Alpha UniqueAgy/);
    expect(report.content).not.toMatch(/Instruction Bravo UniqueAgy Marker/);
  });

  test("validate/preview does not write when write=false", async () => {
    const project = createTempProject("bapm-agy-compile-preview-");
    cleanup = project.cleanup;
    const skill = join(project.cwd, "skill.md");
    writeFileSync(skill, "---\nname: preview\n---\n# Preview\n", "utf8");

    const target = loadAntigravityIntegration();
    const compile = target.compile;
    if (!compile) throw new Error("antigravity target must support compile");

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
