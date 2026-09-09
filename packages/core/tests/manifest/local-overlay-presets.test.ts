/**
 * Overlay structured `active`, presets disallowed, local preset pick
 * (promoted from manifest-presets acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  activeEntriesOf,
  createTempProject,
  documentOf,
  expectThrowsMatching,
  getLoadEffectiveManifest,
  getResolveActive,
  getResolveDependencyGraph,
  nodeNames,
  resolvedIdsOf,
  writeBaseManifest,
  writeLocalOverlay,
  writePackageAt,
  type TempProject,
} from "./presets-helpers.ts";

describe("manifest overlay presets — structured active", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("overlay structured target active is accepted", () => {
    project = createTempProject();
    writeBaseManifest(
      project.cwd,
      ["name: overlay-active", "version: 0.0.1", "dependencies:", "  apm: []", ""].join("\n"),
    );
    writeLocalOverlay(project.cwd, ["active:", "  target: cursor", ""].join("\n"));

    const doc = documentOf(getLoadEffectiveManifest()({ cwd: project.cwd }));
    expect(activeEntriesOf(doc)).toEqual([
      expect.objectContaining({ kind: "target", id: "cursor", negate: false }),
    ]);
  });

  test("overlay structured preset active shape accepted when base defines preset", () => {
    project = createTempProject();
    writeBaseManifest(
      project.cwd,
      [
        "name: overlay-preset-shape",
        "version: 0.0.1",
        "dependencies:",
        "  apm: []",
        "presets:",
        "  - name: developer",
        "    dependencies:",
        "      apm: []",
        "",
      ].join("\n"),
    );
    writeLocalOverlay(project.cwd, ["active:", "  preset: developer", ""].join("\n"));

    const doc = documentOf(getLoadEffectiveManifest()({ cwd: project.cwd }));
    expect(activeEntriesOf(doc)).toEqual([
      expect.objectContaining({ kind: "preset", id: "developer", negate: false }),
    ]);
  });

  test("presets key on overlay is rejected fail-closed", () => {
    project = createTempProject();
    writeBaseManifest(
      project.cwd,
      ["name: forbid-presets", "version: 0.0.1", "dependencies:", "  apm: []", ""].join("\n"),
    );
    writeLocalOverlay(
      project.cwd,
      ["presets:", "  - name: sneaky", "    dependencies:", "      apm: []", ""].join("\n"),
    );

    expectThrowsMatching(
      () => getLoadEffectiveManifest()({ cwd: project!.cwd }),
      /presets|disallowed|forbidden|allowlist|not allowed|unknown/i,
    );
  });

  test("local active replaces base active entirely (not append)", () => {
    project = createTempProject();
    writeBaseManifest(
      project.cwd,
      [
        "name: replace-active",
        "version: 0.0.1",
        "dependencies:",
        "  apm: []",
        "presets:",
        "  - name: developer",
        "    dependencies:",
        "      apm: []",
        "active:",
        "  target: cursor",
        "",
      ].join("\n"),
    );
    writeLocalOverlay(
      project.cwd,
      ["active:", "  preset: developer", "  target: x-acme-editor", ""].join("\n"),
    );

    const doc = documentOf(getLoadEffectiveManifest()({ cwd: project.cwd }));
    const entries = activeEntriesOf(doc);
    expect(entries.map((e) => `${e.kind}:${e.id}`)).toEqual([
      "preset:developer",
      "target:x-acme-editor",
    ]);
    expect(entries.some((e) => e.id === "cursor")).toBe(false);
  });

  test("local preset selection uses base preset definitions in resolve graph", async () => {
    project = createTempProject();
    writePackageAt(project.cwd, "pkgs/dev-skill", "dev-skill");
    writeBaseManifest(
      project.cwd,
      [
        "name: local-pick-preset",
        "version: 0.0.1",
        "dependencies:",
        "  apm: []",
        "presets:",
        "  - name: developer",
        "    dependencies:",
        "      apm:",
        "        - local: ./pkgs/dev-skill",
        "",
      ].join("\n"),
    );
    writeLocalOverlay(project.cwd, ["active:", "  preset: developer", ""].join("\n"));

    const effective = documentOf(getLoadEffectiveManifest()({ cwd: project.cwd }));
    const resolved = resolvedIdsOf(getResolveActive()(effective));
    expect(resolved.presetIds).toContain("developer");

    const graph = await getResolveDependencyGraph()({ cwd: project.cwd });
    expect(nodeNames(graph)).toContain("dev-skill");
  });
});
