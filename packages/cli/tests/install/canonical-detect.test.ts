/**
 * Happy path without object-map + missing canonical package guidance.
 * Promoted from docs-host-happy-path acceptance.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownFlags,
  existsSync,
  linkCursorIntegration,
  runInProject,
  skillPath,
  writeNoMapProject,
  type TempProject,
} from "./canonical-host-helpers.ts";

describe("CLI install · canonical detect (no targets map)", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("without targets:, resolvable @b-apm/integration-cursor + sole Cursor detect → install materializes (no --target)", async () => {
    project = createTempProject();
    linkCursorIntegration(project.cwd);
    writeNoMapProject(project.cwd, {
      name: "acc-no-map-detect",
      withCursor: true,
      withLeafSkill: true,
    });

    const { result, combined } = await runInProject(project.cwd, ["install"]);
    expectKnownFlags(combined);

    expect(combined).not.toMatch(/Target detection is missing or ambiguous/i);
    expect(combined).not.toMatch(/unknown or unregistered target:\s*cursor/i);
    expect(result).toBe(0);
    expect(existsSync(skillPath(project.cwd))).toBe(true);
  });

  test("sole Cursor detect without installed canonical package → clear fail + install guidance", async () => {
    project = createTempProject();
    writeNoMapProject(project.cwd, {
      name: "acc-detect-no-pkg",
      withCursor: true,
      withLeafSkill: true,
    });
    // Deliberately do NOT link @b-apm/integration-cursor.

    const { result, combined } = await runInProject(project.cwd, ["install"]);
    expectKnownFlags(combined);

    expect(result).not.toBe(0);
    expect(existsSync(skillPath(project.cwd))).toBe(false);
    // Guidance must point at installing the canonical integration — not only generic detect ambiguity.
    expect(combined).toMatch(/@b-apm\/integration-cursor|integration-cursor/i);
    expect(combined).toMatch(/install|npm|package|resolv/i);
  });
});
