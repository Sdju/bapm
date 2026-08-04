/**
 * Primitives discovery + pr-001/002/003 + skill bundle.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  diagnosticsOf,
  getDiscoverPrimitives,
  getResolvePrimitiveConflicts,
  nameOf,
  primitivesOf,
  sourceOf,
  typeOfPrimitive,
  writeText,
  type TempProject,
} from "../install/helpers.ts";

describe("primitives discovery (pr-001..003)", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("local attribution — project .apm/skills → source local (pr-001) (§5)", () => {
    project = createTempProject();
    writeText(
      join(project.cwd, ".apm", "skills", "foo", "SKILL.md"),
      "---\nname: foo\n---\n# Foo\n",
    );

    const discover = getDiscoverPrimitives();
    const found = primitivesOf(discover({ cwd: project.cwd }));
    const foo = found.find((p) => nameOf(p) === "foo" || String(p.path ?? "").includes("foo"));
    expect(foo).toBeTruthy();
    expect(sourceOf(foo!)).toBe("local");
  });

  test("dependency attribution — modules package → dependency:<name> (pr-001) (§6)", () => {
    project = createTempProject();
    const depRoot = join(project.cwd, "apm_modules", "github.com", "example", "dep-pkg");
    mkdirSync(depRoot, { recursive: true });
    writeFileSync(
      join(depRoot, "apm.yml"),
      `name: dep-pkg\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    writeText(
      join(depRoot, ".apm", "skills", "dep-skill", "SKILL.md"),
      "---\nname: dep-skill\n---\n# Dep\n",
    );

    const discover = getDiscoverPrimitives();
    const found = primitivesOf(
      discover({
        cwd: project.cwd,
        modulesDir: join(project.cwd, "apm_modules"),
      }),
    );
    const skill = found.find(
      (p) => nameOf(p) === "dep-skill" || String(p.path ?? "").includes("dep-skill"),
    );
    expect(skill).toBeTruthy();
    expect(sourceOf(skill!)).toMatch(/^dependency:(dep-pkg|example\/dep-pkg)/);
  });

  test("local overrides same name+type from dep; diagnostic inspectable (pr-002) (§7)", () => {
    project = createTempProject();
    writeText(
      join(project.cwd, ".apm", "skills", "shared", "SKILL.md"),
      "---\nname: shared\n---\n# Local shared\n",
    );
    const depRoot = join(project.cwd, "apm_modules", "github.com", "example", "other");
    mkdirSync(depRoot, { recursive: true });
    writeFileSync(
      join(depRoot, "apm.yml"),
      `name: other\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    writeText(
      join(depRoot, ".apm", "skills", "shared", "SKILL.md"),
      "---\nname: shared\n---\n# Dep shared\n",
    );

    const discover = getDiscoverPrimitives();
    const raw = primitivesOf(discover({ cwd: project.cwd }));
    const resolveConflicts = getResolvePrimitiveConflicts();
    const resolved = resolveConflicts({
      primitives: raw,
      cwd: project.cwd,
    });
    const set = primitivesOf(resolved);
    const winners = set.filter((p) => nameOf(p) === "shared");
    expect(winners.length).toBe(1);
    expect(sourceOf(winners[0]!)).toBe("local");
    expect(diagnosticsOf(resolved).length).toBeGreaterThan(0);
  });

  test("first-declared dep wins among deps (pr-003) (§8)", () => {
    project = createTempProject();
    for (const [name, folder] of [
      ["pkg-a", "a"],
      ["pkg-b", "b"],
    ] as const) {
      const depRoot = join(project.cwd, "apm_modules", "github.com", "example", folder);
      mkdirSync(depRoot, { recursive: true });
      writeFileSync(
        join(depRoot, "apm.yml"),
        `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
        "utf8",
      );
      writeText(
        join(depRoot, ".apm", "skills", "dup", "SKILL.md"),
        `---\nname: dup\n---\n# From ${name}\n`,
      );
    }

    const discover = getDiscoverPrimitives();
    const raw = primitivesOf(
      discover({
        cwd: project.cwd,
        // declaration order A then B
        declarationOrder: ["pkg-a", "pkg-b"],
      }),
    );
    const resolveConflicts = getResolvePrimitiveConflicts();
    const resolved = resolveConflicts({
      primitives: raw,
      declarationOrder: ["pkg-a", "pkg-b"],
    });
    const set = primitivesOf(resolved);
    const winners = set.filter((p) => nameOf(p) === "dup");
    expect(winners.length).toBe(1);
    expect(sourceOf(winners[0]!)).toBe("dependency:pkg-a");
  });

  test("skill bundle — package root SKILL.md is one skill unit (§9)", () => {
    project = createTempProject();
    const depRoot = join(project.cwd, "apm_modules", "github.com", "example", "bundle");
    mkdirSync(depRoot, { recursive: true });
    writeFileSync(
      join(depRoot, "apm.yml"),
      `name: bundle\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    writeText(join(depRoot, "SKILL.md"), "---\nname: bundle-skill\n---\n# Bundle\n");

    const discover = getDiscoverPrimitives();
    const found = primitivesOf(discover({ cwd: project.cwd }));
    const skill = found.find(
      (p) =>
        /skill/i.test(typeOfPrimitive(p)) ||
        nameOf(p) === "bundle" ||
        nameOf(p) === "bundle-skill" ||
        String(p.path ?? "").endsWith("SKILL.md"),
    );
    expect(skill).toBeTruthy();
    expect(sourceOf(skill!)).toMatch(/^dependency:/);
  });
});
