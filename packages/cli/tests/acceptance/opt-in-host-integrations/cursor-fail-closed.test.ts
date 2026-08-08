/**
 * Cursor is not built-in: --target / legacy string without object-map fail closed.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  existsSync,
  join,
  runInProject,
  writeProject,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("opt-in-host-integrations · cursor fail-closed without map", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("install --target cursor without object-map fails closed naming cursor", async () => {
    project = createTempProject();
    writeProject(project.cwd, {
      name: "acc-cursor-no-map",
      withLeafSkill: true,
      withCursorDetect: true,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/cursor/i);
    expect(combined).toMatch(/unknown or unregistered target|not (?:a )?registered|unregistered/i);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(false);
  });

  test("compile --target cursor without object-map fails closed", async () => {
    project = createTempProject();
    writeProject(project.cwd, {
      name: "acc-compile-cursor-no-map",
      withCursorDetect: true,
    });
    writeText(project.cwd, ".apm/instructions/guide.md", "# Guide\nPrefer short answers.\n");

    const { result, combined } = await runInProject(project.cwd, ["compile", "--target", "cursor"]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/cursor/i);
    expect(combined).toMatch(/unknown or unregistered target|not (?:a )?registered|unregistered/i);
  });

  test("legacy string target: cursor does not register cursor without object-map", async () => {
    project = createTempProject();
    writeProject(project.cwd, {
      name: "acc-legacy-string-cursor",
      legacyTarget: "cursor",
      withLeafSkill: true,
      withCursorDetect: true,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/cursor/i);
    expect(combined).toMatch(/unknown or unregistered target|not (?:a )?registered|unregistered/i);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(false);
  });

  test("unknown forced id diagnostic SHOULD hint at install + targets object-map", async () => {
    project = createTempProject();
    writeProject(project.cwd, {
      name: "acc-missing-hint",
      withLeafSkill: true,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/cursor/i);
    expect(combined).toMatch(/targets:|object-map|@bapm\/integration|install.*integration/i);
  });
});
