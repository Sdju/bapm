/**
 * Materialize: rules/workflows under .windsurf; skills under .agents;
 * agents skipped; deploy-root containment; no global_rules / windsurf skills
 * (integration-windsurf-runtime acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  loadWindsurfIntegration,
  reportDiagnostics,
  writePrimitiveFile,
} from "./helpers.ts";

describe("windsurf materialize", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("instruction becomes .windsurf/rules/<name>.md preserving trigger/globs", async () => {
    const project = createTempProject("bapm-windsurf-instr-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".windsurf"), { recursive: true });
    const src = writePrimitiveFile(
      project.cwd,
      "style.md",
      '---\ntrigger: glob\nglobs:\n  - "**/*.ts"\n---\n# Style rule\n',
    );

    const target = loadWindsurfIntegration();
    await target.materialize([{ name: "style", type: "instruction", source: "local", path: src }], {
      cwd: project.cwd,
      targetId: "windsurf",
      deployRoots: target.deployRoots,
    });

    const dest = join(project.cwd, ".windsurf", "rules", "style.md");
    expect(existsSync(dest)).toBe(true);
    const body = readFileSync(dest, "utf8");
    expect(body).toMatch(/Style rule/);
    expect(body).toMatch(/trigger/);
    expect(body).toMatch(/globs/);
    expect(body).toMatch(/\*\*\/\*\.ts/);
    expect(
      existsSync(join(project.cwd, ".codeium", "windsurf", "memories", "global_rules.md")),
    ).toBe(false);
  });

  test("command lands under .windsurf/workflows not commands", async () => {
    const project = createTempProject("bapm-windsurf-workflow-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".windsurf"), { recursive: true });
    const src = writePrimitiveFile(
      project.cwd,
      "review.md",
      "---\ndescription: review\n---\n# Review workflow\n",
    );

    const target = loadWindsurfIntegration();
    await target.materialize([{ name: "review", type: "command", source: "local", path: src }], {
      cwd: project.cwd,
      targetId: "windsurf",
      deployRoots: target.deployRoots,
    });

    const dest = join(project.cwd, ".windsurf", "workflows", "review.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toMatch(/Review workflow/);
    expect(existsSync(join(project.cwd, ".windsurf", "commands", "review.md"))).toBe(false);
    expect(existsSync(join(project.cwd, ".cursor", "commands", "review.md"))).toBe(false);
  });

  test("agent primitive is skipped with diagnostic and no agents tree", async () => {
    const project = createTempProject("bapm-windsurf-agent-skip-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".windsurf"), { recursive: true });
    const src = writePrimitiveFile(project.cwd, "scout.md", "---\nname: scout\n---\n# Scout\n");

    const target = loadWindsurfIntegration();
    const report = await target.materialize(
      [{ name: "scout", type: "agent", source: "local", path: src }],
      { cwd: project.cwd, targetId: "windsurf", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(project.cwd, ".windsurf", "agents", "scout.md"))).toBe(false);
    expect(existsSync(join(project.cwd, ".windsurf", "agents", "scout.agent.md"))).toBe(false);
    const diagnostics = reportDiagnostics(report);
    expect(
      diagnostics.some(
        (d: { code?: string; message?: string }) =>
          String(d.code ?? "").includes("AGENTS") ||
          /agent/i.test(String(d.message ?? "")) ||
          /unsupported/i.test(String(d.message ?? "")),
      ),
    ).toBe(true);
  });

  test("skill appears under .agents/skills and not .windsurf/skills", async () => {
    const project = createTempProject("bapm-windsurf-skill-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".windsurf"), { recursive: true });
    const srcDir = join(project.cwd, "src-skill");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "SKILL.md"), "---\nname: hello\n---\n# Hello\n", "utf8");

    const target = loadWindsurfIntegration();
    await target.materialize(
      [{ name: "hello", type: "skill", source: "local", path: join(srcDir, "SKILL.md") }],
      { cwd: project.cwd, targetId: "windsurf", deployRoots: target.deployRoots },
    );

    const dest = join(project.cwd, ".agents", "skills", "hello", "SKILL.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toMatch(/Hello/);
    expect(existsSync(join(project.cwd, ".windsurf", "skills", "hello", "SKILL.md"))).toBe(false);
  });

  test("portable Agent Plugins skill directory is fully copied", async () => {
    const project = createTempProject("bapm-windsurf-portable-skill-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".windsurf"), { recursive: true });
    const pluginRoot = join(project.cwd, "plugin");
    const skillDir = join(pluginRoot, "skills", "example");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: example\n---\n# Example\n", "utf8");
    writeFileSync(join(skillDir, "guide.md"), "auxiliary skill file\n", "utf8");

    const target = loadWindsurfIntegration();
    await target.materialize(
      [
        {
          name: "example",
          type: "skill",
          source: "local",
          path: join(skillDir, "SKILL.md"),
          format: "agent-plugin",
          skillDirectory: skillDir,
          pluginRoot,
        },
      ],
      { cwd: project.cwd, targetId: "windsurf", deployRoots: target.deployRoots },
    );

    expect(
      readFileSync(join(project.cwd, ".agents", "skills", "example", "guide.md"), "utf8"),
    ).toBe("auxiliary skill file\n");
    expect(existsSync(join(project.cwd, ".agents", "skills", "example", "SKILL.md"))).toBe(true);
    expect(existsSync(join(project.cwd, ".windsurf", "skills", "example", "SKILL.md"))).toBe(false);
  });

  test("materialize refuses escapes outside deploy roots", async () => {
    const project = createTempProject("bapm-windsurf-escape-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".windsurf"), { recursive: true });
    const srcDir = join(project.cwd, "src-skill");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "SKILL.md"), "---\nname: escape\n---\n# Escape\n", "utf8");

    const target = loadWindsurfIntegration();
    await expect(
      target.materialize(
        [{ name: "escape", type: "skill", source: "local", path: join(srcDir, "SKILL.md") }],
        { cwd: project.cwd, targetId: "windsurf", deployRoots: [".windsurf"] },
      ),
    ).rejects.toThrow();
    expect(existsSync(join(project.cwd, ".agents", "skills", "escape", "SKILL.md"))).toBe(false);
  });

  test("forced windsurf creates deploy roots when absent", async () => {
    const project = createTempProject("bapm-windsurf-force-roots-");
    cleanup = project.cleanup;
    expect(existsSync(join(project.cwd, ".windsurf"))).toBe(false);
    expect(existsSync(join(project.cwd, ".agents"))).toBe(false);

    const srcDir = join(project.cwd, "src-skill");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "SKILL.md"), "---\nname: forced\n---\n# Forced\n", "utf8");

    const target = loadWindsurfIntegration();
    await target.materialize(
      [{ name: "forced", type: "skill", source: "local", path: join(srcDir, "SKILL.md") }],
      { cwd: project.cwd, targetId: "windsurf", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(project.cwd, ".agents", "skills", "forced", "SKILL.md"))).toBe(true);
  });

  test("global_rules is not written by materialize", async () => {
    const project = createTempProject("bapm-windsurf-no-global-rules-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".windsurf"), { recursive: true });
    const src = writePrimitiveFile(project.cwd, "note.md", "# Note\n");

    const target = loadWindsurfIntegration();
    await target.materialize([{ name: "note", type: "instruction", source: "local", path: src }], {
      cwd: project.cwd,
      targetId: "windsurf",
      deployRoots: target.deployRoots,
    });

    expect(existsSync(join(project.cwd, ".windsurf", "rules", "note.md"))).toBe(true);
    expect(
      existsSync(join(project.cwd, ".codeium", "windsurf", "memories", "global_rules.md")),
    ).toBe(false);
    expect(existsSync(join(project.cwd, "memories", "global_rules.md"))).toBe(false);
  });
});
