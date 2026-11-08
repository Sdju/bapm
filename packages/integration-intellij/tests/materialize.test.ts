/**
 * MCP-only materialize: never writes file primitives for IntelliJ.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, loadIntellijIntegration, writeText } from "./helpers.ts";

describe("intellij materialize", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("skills are not deployed for the MCP-only host", async () => {
    const project = createTempProject("bapm-intellij-materialize-");
    cleanup = project.cleanup;
    const skill = writeText(project.cwd, "src-skill/SKILL.md", "---\nname: hello\n---\n# Hello\n");

    const target = loadIntellijIntegration();
    const report = await target.materialize(
      [{ name: "hello", type: "skill", source: "local", path: skill }],
      { cwd: project.cwd, targetId: "intellij", deployRoots: target.deployRoots },
    );

    expect(report?.deployedFiles).toEqual([]);
    expect(report?.diagnostics?.some((d) => d.code === "INTELLIJ_PRIMITIVE_UNSUPPORTED")).toBe(
      true,
    );
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello"))).toBe(false);
    expect(existsSync(join(project.cwd, ".github"))).toBe(false);
  });
});
