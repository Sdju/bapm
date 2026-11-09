/**
 * CLI install diagnostics: skipped primitives, target allow-list filtering,
 * and MCP opt-in directory skips must be visible on stderr.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  PACKAGES_ROOT,
  createTempProject,
  linkClaudeIntegration,
  linkCursorIntegration,
  linkPackageDir,
  runInProject,
  writeText,
  type TempProject,
} from "./canonical-host-helpers.ts";

function writeLeafSkill(cwd: string): void {
  writeText(cwd, "leaf/apm.yml", "name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n");
  writeText(cwd, "leaf/.apm/skills/hello/SKILL.md", "---\nname: hello\n---\n# Hello\n");
}

describe("CLI install · diagnostics visibility", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("unsupported primitive skip prints a warning for the active host", async () => {
    project = createTempProject();
    linkPackageDir(project.cwd, join(PACKAGES_ROOT, "integration-opencode"));
    mkdirSync(join(project.cwd, ".opencode"), { recursive: true });
    writeText(
      project.cwd,
      "dep/apm.yml",
      "name: hook-dep\nversion: 0.0.1\ndependencies:\n  apm: []\n",
    );
    writeText(
      project.cwd,
      "dep/.apm/hooks/pre-tool.json",
      `${JSON.stringify({ hooks: { sessionStart: [{ command: "./scripts/x.sh" }] } }, null, 2)}\n`,
    );
    writeText(
      project.cwd,
      "bapm.yml",
      "name: skip-warning\nversion: 0.0.1\ntarget: opencode\ndependencies:\n  apm:\n    - path: ./dep\n",
    );

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "install",
      "--target",
      "opencode",
    ]);

    expect(result).toBe(0);
    expect(stderr.join("\n")).toMatch(/bapm: warning:/i);
    expect(combined).toMatch(/hook|unsupported|not support/i);
    expect(existsSync(join(project.cwd, ".opencode", "hooks.json"))).toBe(false);
  });

  test("unknown top-level manifest key prints a warning during install", async () => {
    project = createTempProject();
    linkCursorIntegration(project.cwd);
    writeLeafSkill(project.cwd);
    writeText(
      project.cwd,
      "bapm.yml",
      [
        "name: unknown-key-warning",
        "version: 0.0.1",
        "target: cursor",
        "future_feature_flag: true",
        "dependencies:",
        "  apm:",
        "    - path: ./leaf",
        "",
      ].join("\n"),
    );

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "install",
      "--target",
      "cursor",
    ]);

    expect(result, combined).toBe(0);
    expect(stderr.join("\n")).toMatch(/bapm: warning:/i);
    expect(stderr.join("\n")).toMatch(/future_feature_flag/);
    expect(stderr.join("\n")).toMatch(/x-\[a-z\]|vendor extension|unknown top-level/i);
  });

  test("targets {cursor} + --target claude fails with empty intersection and writes no claude files", async () => {
    project = createTempProject();
    const cursorSpec = linkCursorIntegration(project.cwd);
    linkClaudeIntegration(project.cwd);
    writeLeafSkill(project.cwd);
    writeText(
      project.cwd,
      "bapm.yml",
      [
        "name: empty-intersection",
        "version: 0.0.1",
        "targets:",
        `  cursor: "${cursorSpec}"`,
        "dependencies:",
        "  apm:",
        "    - path: ./leaf",
        "",
      ].join("\n"),
    );

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "claude"]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/no active target is declared|empty intersection/i);
    expect(combined).toMatch(/claude/i);
    expect(combined).toMatch(/cursor/i);
    expect(combined).not.toMatch(/installed for claude/i);
    expect(existsSync(join(project.cwd, ".claude"))).toBe(false);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(false);
    expect(existsSync(join(project.cwd, "bapm.lock.yaml"))).toBe(false);
  });

  test("partial intersection installs declared host and warns about the skipped one", async () => {
    project = createTempProject();
    const cursorSpec = linkCursorIntegration(project.cwd);
    linkClaudeIntegration(project.cwd);
    writeLeafSkill(project.cwd);
    writeText(
      project.cwd,
      "bapm.yml",
      [
        "name: partial-intersection",
        "version: 0.0.1",
        "active:",
        "  target:",
        "    - cursor",
        "    - claude",
        "targets:",
        `  cursor: "${cursorSpec}"`,
        "dependencies:",
        "  apm:",
        "    - path: ./leaf",
        "",
      ].join("\n"),
    );

    const { result, stderr } = await runInProject(project.cwd, ["install"]);

    expect(result).toBe(0);
    expect(stderr.join("\n")).toMatch(/bapm: warning:/i);
    expect(stderr.join("\n")).toMatch(/claude/i);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(true);
    expect(existsSync(join(project.cwd, ".claude"))).toBe(false);
  });

  test("MCP-only install for Claude without .claude/ prints a visible warning", async () => {
    project = createTempProject();
    linkClaudeIntegration(project.cwd);
    writeText(
      project.cwd,
      "bapm.yml",
      [
        "name: mcp-dir-warning",
        "version: 0.0.1",
        "target: claude",
        "dependencies:",
        "  mcp:",
        "    - name: dep-server",
        "      type: stdio",
        "      command: echo",
        "",
      ].join("\n"),
    );

    const { result, stderr } = await runInProject(project.cwd, [
      "install",
      "--only",
      "mcp",
      "--target",
      "claude",
    ]);

    expect(result).toBe(0);
    expect(stderr.join("\n")).toMatch(/bapm: warning:/i);
    expect(stderr.join("\n")).toMatch(/\.claude\/|opt-in/i);
    expect(existsSync(join(project.cwd, ".mcp.json"))).toBe(false);
    expect(existsSync(join(project.cwd, ".claude"))).toBe(false);
  });

  test("unknown skill subset names print EMPTY_SKILL_SUBSET and deploy nothing", async () => {
    project = createTempProject();
    linkCursorIntegration(project.cwd);
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeSkillPackage(project.cwd, "fixture", ["alpha", "beta"]);
    writeText(
      project.cwd,
      "bapm.yml",
      [
        "name: empty-skill-subset",
        "version: 0.0.1",
        "active:",
        "  target: cursor",
        "dependencies:",
        "  apm:",
        "    - path: ./fixture",
        "      skills: [gamma]",
        "",
      ].join("\n"),
    );

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "install",
      "--no-frozen",
      "--no-policy",
      "--target",
      "cursor",
    ]);

    expect(result, combined).toBe(0);
    expect(stderr.join("\n")).toMatch(/bapm: warning:/i);
    expect(stderr.join("\n")).toMatch(/EMPTY_SKILL_SUBSET|matched zero skills/i);
    expect(stderr.join("\n")).toMatch(/gamma/);
    expect(existsSync(join(project.cwd, ".agents", "skills", "alpha", "SKILL.md"))).toBe(false);
    expect(existsSync(join(project.cwd, ".agents", "skills", "gamma", "SKILL.md"))).toBe(false);
  });

  test("partial skill subset prints unmatched names and deploys the rest", async () => {
    project = createTempProject();
    linkCursorIntegration(project.cwd);
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeSkillPackage(project.cwd, "fixture", ["alpha", "beta"]);
    writeText(
      project.cwd,
      "bapm.yml",
      [
        "name: partial-skill-subset",
        "version: 0.0.1",
        "active:",
        "  target: cursor",
        "dependencies:",
        "  apm:",
        "    - path: ./fixture",
        "      skills: [alpha, ghost]",
        "",
      ].join("\n"),
    );

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "install",
      "--no-frozen",
      "--no-policy",
      "--target",
      "cursor",
    ]);

    expect(result, combined).toBe(0);
    expect(stderr.join("\n")).toMatch(/bapm: warning:/i);
    expect(stderr.join("\n")).toMatch(/SKILL_SUBSET_UNMATCHED|dropped unknown names/i);
    expect(stderr.join("\n")).toMatch(/ghost/);
    expect(existsSync(join(project.cwd, ".agents", "skills", "alpha", "SKILL.md"))).toBe(true);
    expect(existsSync(join(project.cwd, ".agents", "skills", "ghost", "SKILL.md"))).toBe(false);
    expect(existsSync(join(project.cwd, ".agents", "skills", "beta", "SKILL.md"))).toBe(false);
  });
});

function writeSkillPackage(cwd: string, dir: string, skills: string[]): void {
  writeText(cwd, `${dir}/bapm.yml`, `name: ${dir}\nversion: 0.1.0\ndependencies:\n  apm: []\n`);
  for (const skill of skills) {
    writeText(
      cwd,
      `${dir}/.apm/skills/${skill}/SKILL.md`,
      `---\nname: ${skill}\n---\n# ${skill}\n`,
    );
  }
}
