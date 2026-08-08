/**
 * Materialize: steering / agents / skills; skip commands; no .agents/skills.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  ensureKiroDir,
  loadKiroIntegration,
  reportDiagnostics,
  writePrimitiveFile,
} from "./helpers.ts";

describe("kiro materialize", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("scoped instruction becomes steering with fileMatch", async () => {
    const project = createTempProject("bapm-kiro-steering-fm-");
    cleanup = project.cleanup;
    ensureKiroDir(project.cwd);
    const src = writePrimitiveFile(
      project.cwd,
      "python.instructions.md",
      '---\ndescription: Python rules\napplyTo: "src/**/*.py,tests/**/*.py"\n---\n\n# Python\n\nUse type hints.\n',
    );

    const target = loadKiroIntegration();
    await target.materialize(
      [{ name: "python", type: "instruction", source: "local", path: src }],
      { cwd: project.cwd, targetId: "kiro", deployRoots: target.deployRoots },
    );

    const dest = join(project.cwd, ".kiro", "steering", "python.md");
    expect(existsSync(dest)).toBe(true);
    const body = readFileSync(dest, "utf8");
    expect(body).toMatch(/inclusion:\s*fileMatch/);
    expect(body).toMatch(/fileMatchPattern:/);
    expect(body).toMatch(/src\/\*\*\/\*\.py/);
    expect(body).toMatch(/Use type hints/);
  });

  test("unscoped instruction becomes inclusion always", async () => {
    const project = createTempProject("bapm-kiro-steering-always-");
    cleanup = project.cleanup;
    ensureKiroDir(project.cwd);
    const src = writePrimitiveFile(project.cwd, "global.md", "# Global\n\nUse this everywhere.\n");

    const target = loadKiroIntegration();
    await target.materialize(
      [{ name: "global", type: "instruction", source: "local", path: src }],
      { cwd: project.cwd, targetId: "kiro", deployRoots: target.deployRoots },
    );

    const dest = join(project.cwd, ".kiro", "steering", "global.md");
    expect(readFileSync(dest, "utf8")).toMatch(/inclusion:\s*always/);
  });

  test("agent keeps description/model/tools and strips name/unknown", async () => {
    const project = createTempProject("bapm-kiro-agent-fm-");
    cleanup = project.cleanup;
    ensureKiroDir(project.cwd);
    const src = writePrimitiveFile(
      project.cwd,
      "scout.agent.md",
      "---\nname: scout\ndescription: Scout agent\nmodel: gpt-5\ncolor: red\ntools:\n  - read\n  - write\n---\n\n# Scout\n",
    );

    const target = loadKiroIntegration();
    await target.materialize([{ name: "scout", type: "agent", source: "local", path: src }], {
      cwd: project.cwd,
      targetId: "kiro",
      deployRoots: target.deployRoots,
    });

    const dest = join(project.cwd, ".kiro", "agents", "scout.md");
    expect(existsSync(dest)).toBe(true);
    const body = readFileSync(dest, "utf8");
    expect(body).toMatch(/description:\s*Scout agent/);
    expect(body).toMatch(/model:\s*gpt-5/);
    expect(body).toMatch(/tools:/);
    expect(body).toMatch(/-\s*read/);
    expect(body).not.toMatch(/^name:/m);
    expect(body).not.toMatch(/color:/);
  });

  test("agent with unsupported tools fail-closed (no write + diagnostic)", async () => {
    const project = createTempProject("bapm-kiro-agent-fail-");
    cleanup = project.cleanup;
    ensureKiroDir(project.cwd);
    const src = writePrimitiveFile(
      project.cwd,
      "bad.agent.md",
      "---\ndescription: Bad\ntools:\n  - read\n  - INVALID_TOOL\n---\n\nBody.\n",
    );

    const target = loadKiroIntegration();
    const report = await target.materialize(
      [{ name: "bad", type: "agent", source: "local", path: src }],
      { cwd: project.cwd, targetId: "kiro", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(project.cwd, ".kiro", "agents", "bad.md"))).toBe(false);
    const diags = reportDiagnostics(report);
    expect(
      diags.some(
        (d: { message: string; code?: string }) =>
          /tool/i.test(d.message) || /KIRO_AGENT/i.test(String(d.code)),
      ),
    ).toBe(true);
  });

  test("skill lands under .kiro/skills not .agents/skills", async () => {
    const project = createTempProject("bapm-kiro-skill-");
    cleanup = project.cleanup;
    ensureKiroDir(project.cwd);
    const srcDir = join(project.cwd, "src-skill");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "SKILL.md"), "---\nname: hello\n---\n# Hello\n", "utf8");

    const target = loadKiroIntegration();
    await target.materialize(
      [{ name: "hello", type: "skill", source: "local", path: join(srcDir, "SKILL.md") }],
      { cwd: project.cwd, targetId: "kiro", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(project.cwd, ".kiro", "skills", "hello", "SKILL.md"))).toBe(true);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(false);
  });

  test("command/prompt primitives write nothing under .kiro", async () => {
    const project = createTempProject("bapm-kiro-skip-cmd-");
    cleanup = project.cleanup;
    ensureKiroDir(project.cwd);
    const src = writePrimitiveFile(
      project.cwd,
      "review.prompt.md",
      "---\ndescription: review\n---\n# Review\n",
    );

    const target = loadKiroIntegration();
    await target.materialize([{ name: "review", type: "command", source: "local", path: src }], {
      cwd: project.cwd,
      targetId: "kiro",
      deployRoots: target.deployRoots,
    });

    expect(existsSync(join(project.cwd, ".kiro", "commands"))).toBe(false);
    expect(existsSync(join(project.cwd, ".kiro", "prompts"))).toBe(false);
    expect(existsSync(join(project.cwd, ".kiro", "steering", "review.md"))).toBe(false);
  });
});
