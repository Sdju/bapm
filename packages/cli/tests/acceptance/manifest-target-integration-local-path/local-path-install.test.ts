/**
 * Install loads object-map local filesystem paths (directory + explicit file).
 * Change: manifest-target-integration-local-path
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  existsSync,
  IN_ROOT_PI_FILE_REL,
  IN_ROOT_PI_REL,
  join,
  piMarkerPath,
  plantInRootPiAgent,
  readFileSync,
  runInProject,
  writeMapProject,
  type TempProject,
} from "./helpers.ts";

describe("acceptance · local-path map · install", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("install --target x-pi-agent registers in-root relative directory and materializes", async () => {
    project = createTempProject();
    plantInRootPiAgent(project.cwd);
    writeMapProject(project.cwd, {
      name: "acc-local-dir",
      targets: { "x-pi-agent": IN_ROOT_PI_REL },
      withLeafSkill: true,
    });

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--target",
      "x-pi-agent",
    ]);

    expect(combined).not.toMatch(/unknown or unregistered target:\s*x-pi-agent/i);
    expect(result).toBe(0);
    expect(existsSync(piMarkerPath(project.cwd))).toBe(true);
    expect(readFileSync(piMarkerPath(project.cwd), "utf8")).toContain("x-pi-agent");
    expect(existsSync(join(project.cwd, ".pi", "skills", "hello", "SKILL.md"))).toBe(true);
  });

  test("install --target x-pi-agent loads explicit entry file under project root", async () => {
    project = createTempProject();
    plantInRootPiAgent(project.cwd);
    writeMapProject(project.cwd, {
      name: "acc-local-file",
      targets: { "x-pi-agent": IN_ROOT_PI_FILE_REL },
      withLeafSkill: true,
    });

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--target",
      "x-pi-agent",
    ]);

    expect(combined).not.toMatch(/unknown or unregistered target:\s*x-pi-agent/i);
    expect(result).toBe(0);
    expect(existsSync(piMarkerPath(project.cwd))).toBe(true);
  });

  test("map local path alone does not activate host without --target or detect", async () => {
    project = createTempProject();
    plantInRootPiAgent(project.cwd);
    writeMapProject(project.cwd, {
      name: "acc-local-no-activate",
      targets: { "x-pi-agent": IN_ROOT_PI_REL },
      withLeafSkill: true,
    });

    const { result, combined } = await runInProject(project.cwd, ["install"]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/--target\s+<id>|pass --target/i);
    expect(existsSync(piMarkerPath(project.cwd))).toBe(false);
  });
});
