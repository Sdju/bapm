/**
 * Object-map loads/registers runtime integrations before install selection
 * (promoted from manifest-target-integration-load acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  acmeMarkerPath,
  createTempProject,
  existsSync,
  join,
  linkFixturePackage,
  readFileSync,
  runInProject,
  writeLegacyCursorProject,
  writeMapProject,
  type TempProject,
} from "./map-load-helpers.ts";

describe("CLI install · object-map integration load", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("install --target x-acme-editor registers createIntegration map package and materializes", async () => {
    project = createTempProject();
    const spec = linkFixturePackage(project.cwd, "create-integration-pkg");
    writeMapProject(project.cwd, {
      name: "acc-map-create",
      targets: { "x-acme-editor": spec },
      withLeafSkill: true,
    });

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--target",
      "x-acme-editor",
    ]);

    expect(combined).not.toMatch(/unknown or unregistered target:\s*x-acme-editor/i);
    expect(result).toBe(0);
    expect(existsSync(acmeMarkerPath(project.cwd))).toBe(true);
    expect(readFileSync(acmeMarkerPath(project.cwd), "utf8")).toContain("x-acme-editor");
    expect(existsSync(join(project.cwd, ".acme", "skills", "hello", "SKILL.md"))).toBe(true);
  });

  test("install accepts default-export integration object from object-map", async () => {
    project = createTempProject();
    const spec = linkFixturePackage(project.cwd, "default-export-pkg");
    writeMapProject(project.cwd, {
      name: "acc-map-default",
      targets: { "x-acme-default": spec },
      withLeafSkill: true,
    });

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--target",
      "x-acme-default",
    ]);

    expect(combined).not.toMatch(/unknown or unregistered target:\s*x-acme-default/i);
    expect(result).toBe(0);
    expect(existsSync(acmeMarkerPath(project.cwd))).toBe(true);
    expect(readFileSync(acmeMarkerPath(project.cwd), "utf8")).toContain("x-acme-default");
  });

  test("built-in cursor works without a map entry", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    mkdirSync(join(project.cwd, "leaf", ".apm", "skills", "hello"), { recursive: true });
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      "name: acc-cursor-builtin\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n",
      "utf8",
    );
    writeFileSync(
      join(project.cwd, "leaf", "apm.yml"),
      "name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n",
      "utf8",
    );
    writeFileSync(
      join(project.cwd, "leaf", ".apm", "skills", "hello", "SKILL.md"),
      "---\nname: hello\n---\n# Hello\n",
      "utf8",
    );

    const { result } = await runInProject(project.cwd, ["install", "--target", "cursor"]);

    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(true);
  });

  test("map alone does not activate a host without --target or detect", async () => {
    project = createTempProject();
    const spec = linkFixturePackage(project.cwd, "create-integration-pkg");
    writeMapProject(project.cwd, {
      name: "acc-map-no-activate",
      targets: { "x-acme-editor": spec },
      withLeafSkill: true,
    });

    const { result, combined } = await runInProject(project.cwd, ["install"]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/--target\s+<id>|pass --target/i);
    expect(existsSync(acmeMarkerPath(project.cwd))).toBe(false);
  });

  test("legacy string target does not require resolving a package from the field value", async () => {
    project = createTempProject();
    writeLegacyCursorProject(project.cwd, "acc-legacy-string");

    const { result } = await runInProject(project.cwd, ["install"]);

    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(true);
  });
});
