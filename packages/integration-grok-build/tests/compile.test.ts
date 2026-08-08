/**
 * Thin compile → project-root AGENTS.md; honor write intent.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGrokBuildIntegration } from "../src/createGrokBuildIntegration.ts";

describe("grok-build compile", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("compile writes AGENTS.md when write=true", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-grok-u-compile-"));
    const skill = join(cwd, "skill.md");
    writeFileSync(skill, "---\nname: hello\n---\n# Hello skill UniqueGrokUnit\n", "utf8");

    const target = createGrokBuildIntegration();
    const compile = target.compile;
    if (!compile) throw new Error("grok-build target must support compile");

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
    expect(first.content).toMatch(/UniqueGrokUnit/);
  });

  test("validate/preview does not write when write=false", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-grok-u-compile-preview-"));
    const skill = join(cwd, "skill.md");
    writeFileSync(skill, "---\nname: preview\n---\n# Preview\n", "utf8");

    const target = createGrokBuildIntegration();
    const compile = target.compile;
    if (!compile) throw new Error("grok-build target must support compile");

    const preview = await compile(
      [{ name: "preview", type: "skill", source: "local", path: skill }],
      { cwd, write: false },
    );

    expect(preview.wrote).toBe(false);
    expect(preview.content.length).toBeGreaterThan(0);
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(false);
  });
});
