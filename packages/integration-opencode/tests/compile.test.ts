/**
 * compile → project-root AGENTS.md including instructions; honor write intent
 * (promoted from integration-opencode-instructions-compile acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOpencodeIntegration } from "../src/createOpencodeIntegration.ts";

describe("opencode compile", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("compile writes AGENTS.md with deterministic content when write=true", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-oc-compile-write-"));
    mkdirSync(join(cwd, ".opencode"), { recursive: true });
    const skill = join(cwd, "skill.md");
    writeFileSync(skill, "---\nname: hello\n---\n# Hello skill\n", "utf8");

    const target = createOpencodeIntegration();
    const compile = target.compile;
    if (!compile) throw new Error("opencode target must support compile");

    const first = await compile([{ name: "hello", type: "skill", source: "local", path: skill }], {
      cwd,
      write: true,
    });
    const second = await compile([{ name: "hello", type: "skill", source: "local", path: skill }], {
      cwd,
      write: true,
    });

    expect(first.path).toBe("AGENTS.md");
    expect(first.wrote).toBe(true);
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(true);
    expect(first.content).toBe(second.content);
    expect(first.content.length).toBeGreaterThan(0);
  });

  test("instructions are included in AGENTS.md body", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-oc-compile-include-"));
    const skill = join(cwd, "skill.md");
    const instr = join(cwd, "instr.md");
    writeFileSync(skill, "---\nname: skill-a\n---\n# Skill Alpha Unique\n", "utf8");
    writeFileSync(instr, "# Instruction Bravo Unique Marker\n", "utf8");

    const target = createOpencodeIntegration();
    const compile = target.compile;
    if (!compile) throw new Error("opencode target must support compile");

    const report = await compile(
      [
        { name: "skill-a", type: "skill", source: "local", path: skill },
        { name: "instr-b", type: "instruction", source: "local", path: instr },
      ],
      { cwd, write: true },
    );

    expect(report.content).toMatch(/Skill Alpha Unique/);
    expect(report.content).toMatch(/Instruction Bravo Unique Marker/);
  });

  test("validate/preview does not write AGENTS.md when write=false", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-oc-compile-preview-"));
    const skill = join(cwd, "skill.md");
    writeFileSync(skill, "---\nname: preview\n---\n# Preview\n", "utf8");

    const target = createOpencodeIntegration();
    const compile = target.compile;
    if (!compile) throw new Error("opencode target must support compile");

    const preview = await compile(
      [{ name: "preview", type: "skill", source: "local", path: skill }],
      { cwd, write: false },
    );

    expect(preview.path).toBe("AGENTS.md");
    expect(preview.wrote).toBe(false);
    expect(preview.content.length).toBeGreaterThan(0);
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(false);
  });
});
