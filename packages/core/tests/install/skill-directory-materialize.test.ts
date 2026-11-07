/**
 * Native skills materialize as complete directories: auxiliary references and
 * nested assets are deployed and recorded in lock inventory.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createCursorRegistry,
  createTempProject,
  getRunInstall,
  writeText,
  type TempProject,
} from "./commands-hooks-helpers.ts";

describe("install native skill directory materialize", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test(".apm/skills package skill deploys auxiliary files and inventories them", async () => {
    project = createTempProject();
    const depRoot = join(project.cwd, "skill-dep");
    mkdirSync(depRoot, { recursive: true });
    writeFileSync(
      join(depRoot, "apm.yml"),
      `name: skill-dep\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    writeText(join(depRoot, ".apm", "skills", "foo", "SKILL.md"), "---\nname: foo\n---\n# Foo\n");
    writeText(join(depRoot, ".apm", "skills", "foo", "reference.md"), "# Reference\n");
    writeText(join(depRoot, ".apm", "skills", "foo", "assets", "nested.txt"), "asset\n");
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: skill-dir-install\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm:\n    - path: ./skill-dep\n`,
      "utf8",
    );
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });

    const registry = createCursorRegistry();
    await getRunInstall()({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
    });

    const dest = join(project.cwd, ".agents", "skills", "foo");
    expect(readFileSync(join(dest, "SKILL.md"), "utf8")).toMatch(/Foo/);
    expect(readFileSync(join(dest, "reference.md"), "utf8")).toBe("# Reference\n");
    expect(readFileSync(join(dest, "assets", "nested.txt"), "utf8")).toBe("asset\n");

    const lock = readFileSync(join(project.cwd, "bapm.lock.yaml"), "utf8");
    expect(lock).toMatch(/\.agents\/skills\/foo\/SKILL\.md/);
    expect(lock).toMatch(/\.agents\/skills\/foo\/reference\.md/);
    expect(lock).toMatch(/\.agents\/skills\/foo\/assets\/nested\.txt/);
  });

  test("skills/<name> package skill keeps extra markdown beside SKILL.md", async () => {
    project = createTempProject();
    const depRoot = join(project.cwd, "collection-dep");
    mkdirSync(depRoot, { recursive: true });
    writeFileSync(
      join(depRoot, "apm.yml"),
      `name: collection-dep\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    writeText(join(depRoot, "skills", "bar", "SKILL.md"), "---\nname: bar\n---\n# Bar\n");
    writeText(join(depRoot, "skills", "bar", "extra.md"), "# Extra\n");
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: skill-collection-install\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm:\n    - path: ./collection-dep\n`,
      "utf8",
    );
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });

    const registry = createCursorRegistry();
    await getRunInstall()({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
    });

    expect(existsSync(join(project.cwd, ".agents", "skills", "bar", "SKILL.md"))).toBe(true);
    expect(readFileSync(join(project.cwd, ".agents", "skills", "bar", "extra.md"), "utf8")).toBe(
      "# Extra\n",
    );
  });

  test("package-root SKILL.md does not copy unrelated package files", async () => {
    project = createTempProject();
    const depRoot = join(project.cwd, "root-skill-dep");
    mkdirSync(depRoot, { recursive: true });
    writeFileSync(
      join(depRoot, "apm.yml"),
      `name: root-skill-dep\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    writeText(join(depRoot, "SKILL.md"), "---\nname: root-skill\n---\n# Root skill\n");
    writeText(join(depRoot, "README.md"), "# Package readme\n");
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: root-skill-install\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm:\n    - path: ./root-skill-dep\n`,
      "utf8",
    );
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });

    const registry = createCursorRegistry();
    await getRunInstall()({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
    });

    expect(existsSync(join(project.cwd, ".agents", "skills", "root-skill", "SKILL.md"))).toBe(true);
    expect(existsSync(join(project.cwd, ".agents", "skills", "root-skill", "README.md"))).toBe(
      false,
    );
  });
});
