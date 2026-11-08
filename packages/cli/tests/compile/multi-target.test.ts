/**
 * CLI multi-target compile: `--target a,b`, `--all`, collision fail-closed,
 * dry-run previews, and single-target regression.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, linkIntegration, type TempProject } from "./helpers.ts";
import { runInProject } from "../integrations/map-load-helpers.ts";

const AGENTS_FAMILY = [
  "cursor",
  "codex",
  "opencode",
  "kiro",
  "grok-build",
  "hermes",
  "antigravity",
] as const;

function writeMultiCompileProject(cwd: string, ids: string[], name: string): void {
  mkdirSync(join(cwd, ".cursor"), { recursive: true });
  mkdirSync(join(cwd, ".apm", "instructions"), { recursive: true });
  for (const id of ids) linkIntegration(cwd, id);
  writeFileSync(
    join(cwd, "bapm.yml"),
    `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    "utf8",
  );
  writeFileSync(
    join(cwd, ".apm", "instructions", "style.md"),
    "# Style\nPrefer concise answers.\n",
    "utf8",
  );
}

describe("CLI compile multi-target", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("--target cursor,claude writes AGENTS.md and CLAUDE.md in one run", async () => {
    project = createTempProject();
    writeMultiCompileProject(project.cwd, ["cursor", "claude"], "multi-cursor-claude");

    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--target",
      "cursor,claude",
    ]);

    expect(combined).not.toMatch(/unknown compile flag|unexpected compile argument/i);
    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(project.cwd, "CLAUDE.md"))).toBe(true);
    expect(combined).toMatch(/Wrote AGENTS\.md \(cursor\)/);
    expect(combined).toMatch(/Wrote CLAUDE\.md \(claude\)/);
  });

  test("--target cursor,codex collision fails closed and writes nothing", async () => {
    project = createTempProject();
    writeMultiCompileProject(project.cwd, ["cursor", "codex"], "multi-collision");

    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--target",
      "cursor,codex",
    ]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/collision/i);
    expect(combined).toMatch(/cursor/);
    expect(combined).toMatch(/codex/);
    expect(combined).toMatch(/AGENTS\.md/);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });

  test("--all writes every unique-path compile host", async () => {
    project = createTempProject();
    writeMultiCompileProject(project.cwd, ["claude", "gemini", "copilot"], "multi-all-unique");

    const { result, combined } = await runInProject(project.cwd, ["compile", "--all"]);

    expect(result, combined).toBe(0);
    expect(existsSync(join(project.cwd, "CLAUDE.md"))).toBe(true);
    expect(existsSync(join(project.cwd, "GEMINI.md"))).toBe(true);
    expect(existsSync(join(project.cwd, ".github", "copilot-instructions.md"))).toBe(true);
    expect(combined).toMatch(/CLAUDE\.md \(claude\)/);
    expect(combined).toMatch(/GEMINI\.md \(gemini\)/);
    expect(combined).toMatch(/copilot-instructions\.md \(copilot\)/);
  });

  test("--all includes every compile host and fails on shared AGENTS.md", async () => {
    project = createTempProject();
    writeMultiCompileProject(
      project.cwd,
      [...AGENTS_FAMILY, "claude", "gemini", "copilot"],
      "multi-all-collision",
    );

    const { result, combined } = await runInProject(project.cwd, ["compile", "--all"]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/collision/i);
    expect(combined).toMatch(/AGENTS\.md/);
    for (const id of AGENTS_FAMILY) {
      expect(combined).toMatch(new RegExp(`"${id}"`));
    }
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(project.cwd, "CLAUDE.md"))).toBe(false);
    expect(existsSync(join(project.cwd, "GEMINI.md"))).toBe(false);
  });

  test("--dry-run previews every selected target without writing", async () => {
    project = createTempProject();
    writeMultiCompileProject(project.cwd, ["cursor", "claude"], "multi-dry-run");

    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--target",
      "cursor,claude",
      "--dry-run",
    ]);

    expect(result).toBe(0);
    expect(combined).toMatch(/would write AGENTS\.md \(cursor\)/);
    expect(combined).toMatch(/would write CLAUDE\.md \(claude\)/);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(project.cwd, "CLAUDE.md"))).toBe(false);
  });

  test("-o is rejected with multi-target selection", async () => {
    project = createTempProject();
    writeMultiCompileProject(project.cwd, ["cursor", "claude"], "multi-output-reject");

    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--target",
      "cursor,claude",
      "-o",
      "OUT.md",
    ]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/multiple compile targets.*--output/i);
    expect(existsSync(join(project.cwd, "OUT.md"))).toBe(false);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });

  test("--all with -o fails when more than one host is selected", async () => {
    project = createTempProject();
    writeMultiCompileProject(
      project.cwd,
      ["claude", "gemini", "copilot"],
      "multi-all-output-reject",
    );

    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--all",
      "-o",
      "OUT.md",
    ]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/multiple compile targets.*--output/i);
    expect(existsSync(join(project.cwd, "OUT.md"))).toBe(false);
    expect(existsSync(join(project.cwd, "CLAUDE.md"))).toBe(false);
  });

  test("--target and --all together fail closed", async () => {
    project = createTempProject();
    writeMultiCompileProject(project.cwd, ["cursor", "claude"], "multi-conflict-flags");

    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--target",
      "cursor",
      "--all",
    ]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/either --target or --all/i);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });

  test("single --target behavior is unchanged", async () => {
    project = createTempProject();
    writeMultiCompileProject(project.cwd, ["cursor", "claude"], "multi-single-unchanged");

    const { result, combined } = await runInProject(project.cwd, ["compile", "--target", "cursor"]);

    expect(result).toBe(0);
    expect(combined).toMatch(/Wrote AGENTS\.md \(1 primitives\)/);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(project.cwd, "CLAUDE.md"))).toBe(false);
  });
});
