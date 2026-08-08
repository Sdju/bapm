/**
 * Compile composition loads in-root local-path map bindings
 * (promoted from manifest-target-integration-local-path acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  existsSync,
  IN_ROOT_PI_REL,
  piCompilePath,
  plantInRootPiAgent,
  runInProject,
  writeMapProject,
  type TempProject,
} from "./local-path-helpers.ts";

describe("CLI compile · local-path map", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("compile --target x-pi-agent uses in-root local-path map binding", async () => {
    project = createTempProject();
    plantInRootPiAgent(project.cwd);
    writeMapProject(project.cwd, {
      name: "acc-local-compile",
      targets: { "x-pi-agent": IN_ROOT_PI_REL },
      withInstruction: true,
    });

    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--target",
      "x-pi-agent",
    ]);

    expect(combined).not.toMatch(/unknown or unregistered target:\s*x-pi-agent/i);
    expect(result).toBe(0);
    expect(existsSync(piCompilePath(project.cwd))).toBe(true);
  });
});
