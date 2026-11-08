/**
 * Compile: hermes uses the agents family → project-root AGENTS.md.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHermesIntegration } from "../src/createHermesIntegration.ts";

describe("hermes compile", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("compile writes AGENTS.md when write=true", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-hermes-compile-"));
    const skill = join(cwd, "skill.md");
    writeFileSync(skill, "---\nname: hello\n---\n# Hello skill UniqueHermesUnit\n", "utf8");

    const target = createHermesIntegration();
    const compile = target.compile;
    if (!compile) throw new Error("hermes target must support compile");

    const report = await compile([{ name: "hello", type: "skill", source: "local", path: skill }], {
      cwd,
      write: true,
    });

    expect(report.path).toBe("AGENTS.md");
    expect(report.wrote).toBe(true);
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(true);
    expect(report.content).toMatch(/UniqueHermesUnit/);
  });

  test("validate/preview does not write when write=false", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-hermes-compile-preview-"));
    const skill = join(cwd, "skill.md");
    writeFileSync(skill, "---\nname: preview\n---\n# Preview\n", "utf8");

    const target = createHermesIntegration();
    const compile = target.compile;
    if (!compile) throw new Error("hermes target must support compile");

    const preview = await compile(
      [{ name: "preview", type: "skill", source: "local", path: skill }],
      { cwd, write: false },
    );

    expect(preview.wrote).toBe(false);
    expect(existsSync(join(cwd, "AGENTS.md"))).toBe(false);
  });
});
