/**
 * Local map paths must stay within project root (fail-closed containment)
 * (promoted from manifest-target-integration-local-path acceptance).
 */
import { rmSync } from "node:fs";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  absPath,
  createOutsideSibling,
  createTempProject,
  existsSync,
  IN_ROOT_PI_REL,
  join,
  piMarkerPath,
  plantInRootPiAgent,
  plantPiAgent,
  runInProject,
  writeMapProject,
  type TempProject,
} from "./local-path-helpers.ts";

describe("CLI · local-path map · project-root containment", () => {
  let project: TempProject | undefined;
  let outside: string | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
    if (outside) {
      rmSync(outside, { recursive: true, force: true });
      outside = undefined;
    }
  });

  test("relative ../ escape fails closed without importing outside module", async () => {
    project = createTempProject();
    outside = createOutsideSibling(project.cwd, "outside-integration");
    plantPiAgent(outside);

    const escapeSpec = "../outside-integration";
    writeMapProject(project.cwd, {
      name: "acc-escape-relative",
      targets: { "x-pi-agent": escapeSpec },
      withLeafSkill: true,
      withCursor: true,
    });

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--target",
      "cursor",
    ]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/x-pi-agent/);
    expect(combined).toMatch(/outside-integration|\.\.\/outside-integration/);
    expect(combined).toMatch(/escap|project.?root|outside|contain/i);
    expect(existsSync(piMarkerPath(project.cwd))).toBe(false);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(
      false,
    );
  });

  test("absolute path outside project root fails closed without importing", async () => {
    project = createTempProject();
    outside = createOutsideSibling(project.cwd, "abs-outside-integration");
    plantPiAgent(outside);

    const absoluteOutside = absPath(outside);
    writeMapProject(project.cwd, {
      name: "acc-escape-absolute",
      targets: { "x-pi-agent": absoluteOutside },
      withLeafSkill: true,
      withCursor: true,
    });

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--target",
      "cursor",
    ]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/x-pi-agent/);
    expect(combined).toMatch(/escap|project.?root|outside|contain/i);
    expect(existsSync(piMarkerPath(project.cwd))).toBe(false);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(
      false,
    );
  });

  test("in-root relative path is allowed by containment", async () => {
    project = createTempProject();
    plantInRootPiAgent(project.cwd);
    writeMapProject(project.cwd, {
      name: "acc-in-root-ok",
      targets: { "x-pi-agent": IN_ROOT_PI_REL },
      withLeafSkill: true,
    });

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--target",
      "x-pi-agent",
    ]);

    expect(combined).not.toMatch(/escap|project.?root/i);
    expect(combined).not.toMatch(/unknown or unregistered target:\s*x-pi-agent/i);
    expect(result).toBe(0);
    expect(existsSync(piMarkerPath(project.cwd))).toBe(true);
  });

  test("absolute path that normalizes inside project root is allowed", async () => {
    project = createTempProject();
    plantInRootPiAgent(project.cwd);
    const absoluteInRoot = absPath(project.cwd, "agents", "integration", "pi-agent");
    writeMapProject(project.cwd, {
      name: "acc-abs-in-root",
      targets: { "x-pi-agent": absoluteInRoot },
      withLeafSkill: true,
    });

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--target",
      "x-pi-agent",
    ]);

    expect(combined).not.toMatch(/escap|project.?root/i);
    expect(result).toBe(0);
    expect(existsSync(piMarkerPath(project.cwd))).toBe(true);
  });
});
