/**
 * Acceptance: compile composition root loads object-map integrations before selection.
 * Change: manifest-target-integration-load
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  acmeCompilePath,
  createTempProject,
  existsSync,
  linkFixturePackage,
  runInProject,
  writeMapProject,
  type TempProject,
} from "./helpers.ts";

describe("acceptance · manifest-target-integration-load · compile map load", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("compile --target x-acme-editor uses map-loaded compile-capable integration", async () => {
    project = createTempProject();
    const spec = linkFixturePackage(project.cwd, "create-integration-pkg");
    writeMapProject(project.cwd, {
      name: "acc-compile-map",
      targets: { "x-acme-editor": spec },
      withInstruction: true,
    });

    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--target",
      "x-acme-editor",
    ]);

    expect(combined).not.toMatch(/unknown or unregistered target:\s*x-acme-editor/i);
    expect(result).toBe(0);
    expect(existsSync(acmeCompilePath(project.cwd))).toBe(true);
  });

  test("compile unknown target after map still fails closed", async () => {
    project = createTempProject();
    const spec = linkFixturePackage(project.cwd, "create-integration-pkg");
    writeMapProject(project.cwd, {
      name: "acc-compile-unknown",
      targets: { "x-acme-editor": spec },
      withInstruction: true,
    });

    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--target",
      "not-a-host",
    ]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/not-a-host|unknown or unregistered target/i);
    expect(existsSync(acmeCompilePath(project.cwd))).toBe(false);
  });
});
