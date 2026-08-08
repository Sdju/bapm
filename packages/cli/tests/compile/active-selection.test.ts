/**
 * CLI compile sole vs multi `active`.
 * Promoted from manifest-active-targets acceptance.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  acmeCompilePath,
  createTempProject,
  existsSync,
  join,
  linkCursorIntegration,
  linkFixturePackage,
  runInProject,
  writeActiveProject,
  type TempProject,
} from "../install/active-helpers.ts";

describe("CLI compile · manifest active selection", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("compile without --target uses sole active cursor", async () => {
    project = createTempProject();
    writeActiveProject(project.cwd, {
      name: "cli-compile-sole",
      active: ["cursor"],
      withInstruction: true,
    });

    const { result, combined } = await runInProject(project.cwd, ["compile"]);

    expect(combined).not.toMatch(/Target detection is missing or ambiguous/i);
    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(true);
  });

  test("compile multi active without --target fails even with .cursor detect", async () => {
    project = createTempProject();
    const cursorSpec = linkCursorIntegration(project.cwd);
    const acmeSpec = linkFixturePackage(project.cwd, "create-integration-pkg");
    writeActiveProject(project.cwd, {
      name: "cli-compile-multi",
      active: ["cursor", "x-acme-editor"],
      targets: { cursor: cursorSpec, "x-acme-editor": acmeSpec },
      withInstruction: true,
      // Sole cursor detect would succeed today; multi `active` must still require --target.
      withCursor: true,
    });

    const { result, combined } = await runInProject(project.cwd, ["compile"]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/--target\s+<id>/i);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
    expect(existsSync(acmeCompilePath(project.cwd))).toBe(false);
  });

  test("compile --target overrides multi active", async () => {
    project = createTempProject();
    const cursorSpec = linkCursorIntegration(project.cwd);
    const acmeSpec = linkFixturePackage(project.cwd, "create-integration-pkg");
    writeActiveProject(project.cwd, {
      name: "cli-compile-force",
      active: ["cursor", "x-acme-editor"],
      targets: { cursor: cursorSpec, "x-acme-editor": acmeSpec },
      withInstruction: true,
    });

    const { result } = await runInProject(project.cwd, ["compile", "--target", "cursor"]);

    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(true);
    expect(existsSync(acmeCompilePath(project.cwd))).toBe(false);
  });
});
