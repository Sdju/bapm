import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCopilotIntegration } from "../src/index.ts";

describe("createCopilotIntegration compile", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  function temp(): string {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-copilot-unit-compile-"));
    cleanup = () => rmSync(cwd, { recursive: true, force: true });
    return cwd;
  }

  test("omits instructions, is deterministic, honors write=false", async () => {
    const cwd = temp();
    const skill = join(cwd, "skill.md");
    const instr = join(cwd, "instr.md");
    writeFileSync(skill, "# Skill Alpha Unique\n", "utf8");
    writeFileSync(instr, "# Instruction Bravo Unique Marker\n", "utf8");

    const target = createCopilotIntegration();
    const compile = target.compile!;
    const primitives = [
      { name: "skill-a", type: "skill", source: "local" as const, path: skill },
      { name: "instr-b", type: "instruction", source: "local" as const, path: instr },
    ];

    const preview = await compile(primitives, { cwd, write: false });
    expect(preview.wrote).toBe(false);
    expect(preview.path).toBe(".github/copilot-instructions.md");
    expect(preview.content).toMatch(/Skill Alpha Unique/);
    expect(preview.content).not.toMatch(/Instruction Bravo Unique Marker/);
    expect(existsSync(join(cwd, ".github", "copilot-instructions.md"))).toBe(false);

    const first = await compile(primitives, { cwd, write: true });
    const second = await compile(primitives, { cwd, write: true });
    expect(first.wrote).toBe(true);
    expect(first.content).toBe(second.content);
    expect(existsSync(join(cwd, ".github", "extensions"))).toBe(false);
  });
});
