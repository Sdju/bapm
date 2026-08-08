/**
 * Cursor registers only via object-map + resolvable package; selection order preserved.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  existsSync,
  join,
  linkCursorIntegration,
  runInProject,
  writeProject,
  type TempProject,
} from "./helpers.ts";

describe("opt-in-host-integrations · cursor via object-map", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("install --target cursor with map + linked @bapm/integration-cursor materializes", async () => {
    project = createTempProject();
    const spec = linkCursorIntegration(project.cwd);
    writeProject(project.cwd, {
      name: "acc-cursor-via-map",
      targets: { cursor: spec },
      withLeafSkill: true,
      withCursorDetect: true,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);

    expect(combined).not.toMatch(/unknown or unregistered target:\s*cursor/i);
    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(true);
  });

  test("install with active + map activates cursor without --target", async () => {
    project = createTempProject();
    const spec = linkCursorIntegration(project.cwd);
    writeProject(project.cwd, {
      name: "acc-cursor-active-map",
      targets: { cursor: spec },
      active: ["cursor"],
      withLeafSkill: true,
      // No detect signal — active must drive selection.
    });

    const { result, combined } = await runInProject(project.cwd, ["install"]);

    expect(combined).not.toMatch(/Target detection is missing or ambiguous/i);
    expect(combined).not.toMatch(/unknown or unregistered target:\s*cursor/i);
    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(true);
  });

  test("map alone does not activate without --target, active, or detect", async () => {
    project = createTempProject();
    const spec = linkCursorIntegration(project.cwd);
    writeProject(project.cwd, {
      name: "acc-map-no-activate",
      targets: { cursor: spec },
      withLeafSkill: true,
    });

    const { result, combined } = await runInProject(project.cwd, ["install"]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/--target\s+<id>|pass --target|active/i);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(false);
  });

  test("--target overrides multi active after map load", async () => {
    project = createTempProject();
    const cursorSpec = linkCursorIntegration(project.cwd);
    writeProject(project.cwd, {
      name: "acc-force-over-active",
      targets: { cursor: cursorSpec },
      active: ["cursor"],
      withLeafSkill: true,
    });

    const { result } = await runInProject(project.cwd, ["install", "--target", "cursor"]);

    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(true);
  });
});
