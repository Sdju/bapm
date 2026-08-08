/**
 * Compile composition root loads object-map integrations before selection
 * (promoted from manifest-target-integration-load + opt-in-host-integrations).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync } from "node:fs";
import {
  acmeCompilePath,
  createTempProject,
  existsSync,
  join,
  linkFixturePackage,
  runInProject,
  writeMapProject,
  writeText,
  type TempProject,
} from "./map-load-helpers.ts";

describe("CLI compile · object-map integration load", () => {
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

  test("compile --target cursor without object-map fails closed", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeText(
      project.cwd,
      "bapm.yml",
      "name: acc-compile-cursor-no-map\nversion: 0.0.1\ndependencies:\n  apm: []\n",
    );
    writeText(project.cwd, ".apm/instructions/guide.md", "# Guide\nPrefer short answers.\n");

    const { result, combined } = await runInProject(project.cwd, ["compile", "--target", "cursor"]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/cursor/i);
    expect(combined).toMatch(/unknown or unregistered target|not (?:a )?registered|unregistered/i);
  });
});
