/**
 * Materialize: rules (trigger/globs), skills, skip agents/commands.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  loadAntigravityIntegration,
  reportDiagnostics,
  writePrimitiveFile,
} from "./helpers.ts";

describe("antigravity materialize", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("instruction becomes .agents/rules with trigger/globs from applyTo", async () => {
    const project = createTempProject("bapm-agy-rules-");
    cleanup = project.cleanup;
    const instr = writePrimitiveFile(
      project.cwd,
      "pkg/style.instructions.md",
      [
        "---",
        "description: Style rules",
        'applyTo: "src/**/*.ts, tests/**/*.ts"',
        "---",
        "",
        "# Style",
        "",
        "Use type hints.",
        "",
      ].join("\n"),
    );

    const target = loadAntigravityIntegration();
    await target.materialize(
      [
        {
          name: "style",
          type: "instruction",
          source: "local",
          path: instr,
        },
      ],
      { cwd: project.cwd, targetId: "antigravity", deployRoots: target.deployRoots },
    );

    const dest = join(project.cwd, ".agents", "rules", "style.md");
    expect(existsSync(dest)).toBe(true);
    const body = readFileSync(dest, "utf8");
    expect(body).toMatch(/trigger:\s*glob/);
    expect(body).toMatch(/globs:/);
    expect(body).toMatch(/src\/\*\*\/\*\.ts/);
    expect(body).toMatch(/tests\/\*\*\/\*\.ts/);
    expect(body).toMatch(/Use type hints/);
    expect(body).not.toMatch(/applyTo/);
  });

  test("skill appears under .agents/skills/<name>/SKILL.md", async () => {
    const project = createTempProject("bapm-agy-skill-");
    cleanup = project.cleanup;
    const skill = writePrimitiveFile(
      project.cwd,
      "skill-pkg/SKILL.md",
      "---\nname: demo-skill\ndescription: Demo\n---\n\n# Demo\n",
    );

    const target = loadAntigravityIntegration();
    await target.materialize(
      [
        {
          name: "demo-skill",
          type: "skill",
          source: "local",
          path: skill,
        },
      ],
      { cwd: project.cwd, targetId: "antigravity", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(project.cwd, ".agents", "skills", "demo-skill", "SKILL.md"))).toBe(true);
  });

  test("agent and command primitives are skipped with diagnostics", async () => {
    const project = createTempProject("bapm-agy-skip-");
    cleanup = project.cleanup;
    const agent = writePrimitiveFile(project.cwd, "a.md", "# Agent\n");
    const command = writePrimitiveFile(project.cwd, "c.md", "# Command\n");

    const target = loadAntigravityIntegration();
    const report = await target.materialize(
      [
        { name: "helper", type: "agent", source: "local", path: agent },
        { name: "do-it", type: "command", source: "local", path: command },
      ],
      { cwd: project.cwd, targetId: "antigravity", deployRoots: target.deployRoots },
    );

    const diags = reportDiagnostics(report);
    expect(diags.some((d) => /agent/i.test(d.message) || /agent/i.test(String(d.code)))).toBe(true);
    expect(diags.some((d) => /command/i.test(d.message) || /command/i.test(String(d.code)))).toBe(
      true,
    );
    expect(existsSync(join(project.cwd, ".agents", "agents"))).toBe(false);
    expect(existsSync(join(project.cwd, ".agents", "commands"))).toBe(false);
    expect(existsSync(join(project.cwd, ".agents", "workflows"))).toBe(false);
  });

  test("forced materialize may create .agents roots", async () => {
    const project = createTempProject("bapm-agy-mkdir-");
    cleanup = project.cleanup;
    const skill = writePrimitiveFile(project.cwd, "SKILL.md", "---\nname: x\n---\n# X\n");

    const target = loadAntigravityIntegration();
    expect(existsSync(join(project.cwd, ".agents"))).toBe(false);
    await target.materialize([{ name: "x", type: "skill", source: "local", path: skill }], {
      cwd: project.cwd,
      targetId: "antigravity",
      deployRoots: target.deployRoots,
    });
    expect(existsSync(join(project.cwd, ".agents", "skills", "x", "SKILL.md"))).toBe(true);
  });

  test("does not write ~/.gemini paths", async () => {
    const project = createTempProject("bapm-agy-no-home-");
    cleanup = project.cleanup;
    const prevHome = process.env.HOME;
    const fakeHome = join(project.cwd, "fake-home");
    mkdirSync(fakeHome, { recursive: true });
    process.env.HOME = fakeHome;
    try {
      const skill = writePrimitiveFile(project.cwd, "SKILL.md", "---\nname: y\n---\n# Y\n");
      const target = loadAntigravityIntegration();
      await target.materialize([{ name: "y", type: "skill", source: "local", path: skill }], {
        cwd: project.cwd,
        targetId: "antigravity",
        deployRoots: target.deployRoots,
      });
      expect(existsSync(join(fakeHome, ".gemini"))).toBe(false);
    } finally {
      if (prevHome === undefined) delete process.env.HOME;
      else process.env.HOME = prevHome;
    }
  });
});
