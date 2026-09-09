/**
 * Effective deps = base ∪ included presets; conflicts; resolve/lock wiring
 * (promoted from manifest-presets acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  developerAnalystPresetsYaml,
  expectAsyncThrowsMatching,
  expectThrowsMatching,
  getEffectiveDirectDeps,
  getResolveActive,
  getResolveAndLock,
  getResolveDependencyGraph,
  join,
  nodeNames,
  parseOk,
  resolvedIdsOf,
  writeBaseManifest,
  writePackageAt,
  writeText,
  type TempProject,
} from "./presets-helpers.ts";

describe("manifest effective deps — pure helpers", () => {
  test("effectiveDirectDeps unions base with included preset packages", () => {
    const doc = parseOk({
      dependencies: {
        apm: [{ local: "./pkgs/shared-skill" }],
      },
      presets: [
        {
          name: "developer",
          dependencies: {
            apm: [{ local: "./pkgs/dev-skill" }],
          },
        },
      ],
      active: { preset: "developer" },
    });

    const { presetIds } = resolvedIdsOf(getResolveActive()(doc));
    expect(presetIds).toContain("developer");

    const effective = getEffectiveDirectDeps()(doc, presetIds) as Record<string, unknown>;
    const deps = (effective.dependencies ?? effective) as Record<string, unknown>;
    const apm = (deps.apm ?? deps) as unknown[];
    const serialized = JSON.stringify(apm);
    expect(serialized).toMatch(/shared-skill/);
    expect(serialized).toMatch(/dev-skill/);
  });

  test("same package conflicting constraints fail closed", () => {
    const doc = parseOk({
      dependencies: {
        apm: [{ local: "./pkgs/shared", name: "shared-skill" }],
      },
      presets: [
        {
          name: "developer",
          dependencies: {
            apm: [{ local: "./pkgs/other", name: "shared-skill" }],
          },
        },
      ],
      active: { preset: "developer" },
    });

    const { presetIds } = resolvedIdsOf(getResolveActive()(doc));
    expectThrowsMatching(
      () => getEffectiveDirectDeps()(doc, presetIds),
      /shared-skill|conflict|incompatible|disagree/i,
    );
  });

  test("omitted active yields empty presetIds and base-only effective deps", () => {
    const doc = parseOk({
      dependencies: {
        apm: [{ local: "./pkgs/shared-skill" }],
      },
      presets: [
        {
          name: "developer",
          dependencies: {
            apm: [{ local: "./pkgs/dev-skill" }],
          },
        },
      ],
    });

    const resolved = resolvedIdsOf(getResolveActive()(doc));
    expect(resolved.presetIds).toEqual([]);

    const effective = getEffectiveDirectDeps()(doc, resolved.presetIds) as Record<string, unknown>;
    const deps = (effective.dependencies ?? effective) as Record<string, unknown>;
    const serialized = JSON.stringify(deps.apm ?? deps);
    expect(serialized).toMatch(/shared-skill/);
    expect(serialized).not.toMatch(/dev-skill/);
  });
});

describe("manifest effective deps — resolve / lock wiring", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("base plus one included preset unions packages in resolve graph", async () => {
    project = createTempProject();
    writePackageAt(project.cwd, "pkgs/shared-skill", "shared-skill");
    writePackageAt(project.cwd, "pkgs/dev-skill", "dev-skill");
    writeBaseManifest(
      project.cwd,
      [
        "name: union-base-preset",
        "version: 0.0.1",
        "dependencies:",
        "  apm:",
        "    - local: ./pkgs/shared-skill",
        "presets:",
        "  - name: developer",
        "    dependencies:",
        "      apm:",
        "        - local: ./pkgs/dev-skill",
        "active:",
        "  preset: developer",
        "",
      ].join("\n"),
    );

    const graph = await getResolveDependencyGraph()({ cwd: project.cwd });
    const names = nodeNames(graph);
    expect(names).toEqual(expect.arrayContaining(["shared-skill", "dev-skill"]));
  });

  test("target-only active does not pull preset packages", async () => {
    project = createTempProject();
    writePackageAt(project.cwd, "pkgs/dev-skill", "dev-skill");
    writeBaseManifest(
      project.cwd,
      [
        "name: target-only",
        "version: 0.0.1",
        "dependencies:",
        "  apm: []",
        developerAnalystPresetsYaml().trimEnd(),
        "active:",
        "  target: cursor",
        "",
      ].join("\n"),
    );

    const graph = await getResolveDependencyGraph()({ cwd: project.cwd });
    const names = nodeNames(graph);
    expect(names).not.toContain("dev-skill");
    expect(names).not.toContain("analyst-skill");
  });

  test("unknown included preset fails before lock write", async () => {
    project = createTempProject();
    writeBaseManifest(
      project.cwd,
      [
        "name: missing-preset",
        "version: 0.0.1",
        "dependencies:",
        "  apm: []",
        "presets:",
        "  - name: developer",
        "    dependencies:",
        "      apm: []",
        "active:",
        "  preset: missing-role",
        "",
      ].join("\n"),
    );

    await expectAsyncThrowsMatching(
      () => getResolveAndLock()({ cwd: project!.cwd, noPolicy: true }),
      /missing-role/,
    );
  });

  test("preset active cycle fails before modules/lock write", async () => {
    project = createTempProject();
    writeBaseManifest(
      project.cwd,
      [
        "name: cycle-presets",
        "version: 0.0.1",
        "dependencies:",
        "  apm: []",
        "presets:",
        "  - name: a",
        "    active:",
        "      preset: b",
        "    dependencies:",
        "      apm: []",
        "  - name: b",
        "    active:",
        "      preset: a",
        "    dependencies:",
        "      apm: []",
        "active:",
        "  preset: a",
        "",
      ].join("\n"),
    );

    await expectAsyncThrowsMatching(
      () => getResolveAndLock()({ cwd: project!.cwd, noPolicy: true }),
      /cycle|circular|recursive|loop/i,
    );

    const { existsSync } = await import("node:fs");
    expect(existsSync(join(project.cwd, "bapm.lock.yaml"))).toBe(false);
    expect(existsSync(join(project.cwd, "apm.lock.yaml"))).toBe(false);
  });

  test("included preset packages enter lock via resolveAndLock", async () => {
    project = createTempProject();
    writePackageAt(project.cwd, "pkgs/analyst-skill", "analyst-skill");
    writeText(join(project.cwd, ".gitignore"), "/pkgs/\n");
    writeBaseManifest(
      project.cwd,
      [
        "name: preset-lock",
        "version: 0.0.1",
        "dependencies:",
        "  apm: []",
        "presets:",
        "  - name: analyst",
        "    dependencies:",
        "      apm:",
        "        - local: ./pkgs/analyst-skill",
        "active:",
        "  preset: analyst",
        "",
      ].join("\n"),
    );

    await getResolveAndLock()({ cwd: project.cwd, noPolicy: true });

    const { readFileSync, existsSync } = await import("node:fs");
    const lockPath = existsSync(join(project.cwd, "bapm.lock.yaml"))
      ? join(project.cwd, "bapm.lock.yaml")
      : join(project.cwd, "apm.lock.yaml");
    expect(existsSync(lockPath)).toBe(true);
    expect(readFileSync(lockPath, "utf8")).toMatch(/analyst-skill/);
  });
});
