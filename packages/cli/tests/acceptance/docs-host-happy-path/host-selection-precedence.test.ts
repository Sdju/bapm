/**
 * Acceptance (RED): host selection precedence + local active overlay replace.
 * Change: docs-host-happy-path — criteria 5–6 (without requiring targets: for canonical hosts).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownFlags,
  existsSync,
  join,
  linkClaudeIntegration,
  linkCursorIntegration,
  runInProject,
  skillPath,
  writeNoMapProject,
  type TempProject,
} from "./helpers.ts";

function claudeSkillOrRuleHint(cwd: string): boolean {
  // Claude materialize may land under .claude; Cursor under .agents — either proves selection.
  return (
    existsSync(skillPath(cwd)) ||
    existsSync(join(cwd, ".claude")) ||
    existsSync(join(cwd, ".agents", "skills", "hello", "SKILL.md"))
  );
}

describe("docs-host-happy-path · selection precedence (canonical, no map)", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("--target wins over local active and base active", async () => {
    project = createTempProject();
    linkCursorIntegration(project.cwd);
    linkClaudeIntegration(project.cwd);
    writeNoMapProject(project.cwd, {
      name: "acc-flag-wins",
      withLeafSkill: true,
      active: ["claude"],
      localActive: ["claude"],
      withCursor: true,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);
    expect(combined).not.toMatch(/unknown or unregistered target:\s*cursor/i);
    expect(result).toBe(0);
    expect(existsSync(skillPath(project.cwd))).toBe(true);
  });

  test("local active replaces base active (overlay) without --target", async () => {
    project = createTempProject();
    linkCursorIntegration(project.cwd);
    linkClaudeIntegration(project.cwd);
    writeNoMapProject(project.cwd, {
      name: "acc-local-replaces-base",
      withLeafSkill: true,
      active: ["cursor"],
      localActive: ["claude"],
    });

    const { result, combined } = await runInProject(project.cwd, ["install"]);
    expectKnownFlags(combined);
    expect(combined).not.toMatch(/unknown or unregistered target:\s*claude/i);
    expect(combined).not.toMatch(/Target detection is missing or ambiguous/i);
    expect(result).toBe(0);
    // Selection must be claude (local), not cursor (base).
    expect(combined.toLowerCase()).toMatch(/claude/);
    expect(claudeSkillOrRuleHint(project.cwd)).toBe(true);
  });

  test("base active wins over sole detect when local omits active", async () => {
    project = createTempProject();
    linkCursorIntegration(project.cwd);
    linkClaudeIntegration(project.cwd);
    writeNoMapProject(project.cwd, {
      name: "acc-base-over-detect",
      withLeafSkill: true,
      active: ["claude"],
      withCursor: true, // detect would prefer cursor if active ignored
    });

    const { result, combined } = await runInProject(project.cwd, ["install"]);
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(combined).not.toMatch(/unknown or unregistered target:\s*claude/i);
    expect(combined.toLowerCase()).toMatch(/claude/);
  });

  test("multi-detect without --target / active fails closed", async () => {
    project = createTempProject();
    linkCursorIntegration(project.cwd);
    linkClaudeIntegration(project.cwd);
    writeNoMapProject(project.cwd, {
      name: "acc-multi-detect",
      withLeafSkill: true,
      withCursor: true,
      withClaude: true,
    });

    const { result, combined } = await runInProject(project.cwd, ["install"]);
    expectKnownFlags(combined);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/missing or ambiguous|ambiguous/i);
    expect(existsSync(skillPath(project.cwd))).toBe(false);
  });

  test("no detect, no active, no --target fails closed", async () => {
    project = createTempProject();
    linkCursorIntegration(project.cwd);
    writeNoMapProject(project.cwd, {
      name: "acc-no-selection",
      withLeafSkill: true,
      withCursor: false,
    });

    const { result, combined } = await runInProject(project.cwd, ["install"]);
    expectKnownFlags(combined);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/missing or ambiguous|--target|active/i);
    expect(existsSync(skillPath(project.cwd))).toBe(false);
  });
});
