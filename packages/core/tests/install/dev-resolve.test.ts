/**
 * Install --dev write target + root resolve includes devDependencies.apm.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  hasModulesContent,
  installWithSpy,
  listFilesRecursive,
  modulesDir,
  readManifestText,
  writeLeafProject,
  type TempProject,
} from "./ux-helpers.ts";

describe("install dev write + root resolve union", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("positional with dev:true writes devDependencies.apm", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7a-dev-write");
    mkdirSync(join(project.cwd, "extra"), { recursive: true });
    writeFileSync(
      join(project.cwd, "extra", "apm.yml"),
      `name: extra\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );

    const { result } = await installWithSpy(project.cwd, {
      packageRefs: ["./extra"],
      dev: true,
      dryRun: false,
    });

    expect(result).toMatchObject({ ok: true });
    const manifest = readManifestText(project.cwd);
    expect(manifest).toMatch(
      /devDependencies:[\s\S]*apm:[\s\S]*(\.\/extra|path:\s*\.\/extra)/,
    );
    const depsOnly =
      manifest.match(/^dependencies:[\s\S]*?(?=^devDependencies:|^[a-z]|\Z)/m)?.[0] ?? "";
    expect(depsOnly).not.toMatch(/path:\s*\.\/extra|\.\/extra/);
  });

  test("root package listed only under devDependencies.apm is installed", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, "devleaf"), { recursive: true });
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: p7a-dev-resolve
version: 0.0.1
dependencies:
  apm: []
devDependencies:
  apm:
    - path: ./devleaf
`,
      "utf8",
    );
    writeFileSync(
      join(project.cwd, "devleaf", "apm.yml"),
      `name: devleaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    mkdirSync(join(project.cwd, "devleaf", ".apm", "skills", "devskill"), {
      recursive: true,
    });
    writeFileSync(
      join(project.cwd, "devleaf", ".apm", "skills", "devskill", "SKILL.md"),
      "---\nname: devskill\n---\n# Dev\n",
      "utf8",
    );

    const { result } = await installWithSpy(project.cwd, {});

    expect(result).toMatchObject({ ok: true });
    expect(hasModulesContent(project.cwd)).toBe(true);
    const tree = listFilesRecursive(modulesDir(project.cwd)).join("\n");
    expect(tree).toMatch(/devleaf/i);
  });

  test("child devDependencies stay out of transitive graph", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, "parent"), { recursive: true });
    mkdirSync(join(project.cwd, "orphan-dev"), { recursive: true });
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: p7a-child-dev
version: 0.0.1
dependencies:
  apm:
    - path: ./parent
`,
      "utf8",
    );
    writeFileSync(
      join(project.cwd, "parent", "apm.yml"),
      `name: parent
version: 0.0.1
dependencies:
  apm: []
devDependencies:
  apm:
    - path: ../orphan-dev
`,
      "utf8",
    );
    writeFileSync(
      join(project.cwd, "orphan-dev", "apm.yml"),
      `name: orphan-dev\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );

    const { result } = await installWithSpy(project.cwd, {});

    expect(result).toMatchObject({ ok: true });
    const tree = listFilesRecursive(modulesDir(project.cwd)).join("\n");
    expect(tree).toMatch(/parent/i);
    expect(tree).not.toMatch(/orphan-dev/i);
  });
});
