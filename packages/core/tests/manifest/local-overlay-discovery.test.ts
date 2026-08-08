/**
 * Optional bapm.local.yml discovery + apm.local.yml refuse
 * (promoted from manifest-local-overlay acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import {
  conformingBase,
  createTempProject,
  documentOf,
  expectThrowsMatching,
  getLoadEffectiveManifest,
  localPathOf,
  writeBaseManifest,
  writeLocalOverlay,
  writeText,
  type TempProject,
} from "./local-overlay-helpers.ts";

describe("manifest-local-overlay — discovery", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("missing local overlay succeeds with base-only document", () => {
    project = createTempProject();
    writeBaseManifest(project.cwd, conformingBase({ name: "no-local" }));

    const loaded = getLoadEffectiveManifest()({ cwd: project.cwd });
    const doc = documentOf(loaded);
    expect(doc.name).toBe("no-local");
    expect(localPathOf(loaded)).toBeUndefined();
  });

  test("loads valid bapm.local.yml from project root and merges", () => {
    project = createTempProject();
    writeBaseManifest(
      project.cwd,
      conformingBase({
        name: "with-local",
        extraYaml: "active:\n  - cursor\n",
      }),
    );
    writeLocalOverlay(project.cwd, "active:\n  - x-acme-editor\n");

    const loaded = getLoadEffectiveManifest()({ cwd: project.cwd });
    const doc = documentOf(loaded);
    expect(doc.active).toEqual(["x-acme-editor"]);
    const localPath = localPathOf(loaded);
    expect(localPath, "load metadata should expose local overlay path").toBeTruthy();
    expect(String(localPath).replace(/\\/g, "/")).toMatch(/bapm\.local\.yml$/);
  });

  test("does not walk up to parent bapm.local.yml", () => {
    project = createTempProject();
    const parent = project.cwd;
    const child = join(parent, "nested-project");
    writeBaseManifest(parent, conformingBase({ name: "parent-only" }));
    writeLocalOverlay(parent, "active:\n  - x-acme-editor\n");
    writeBaseManifest(
      child,
      conformingBase({
        name: "child",
        extraYaml: "active:\n  - cursor\n",
      }),
    );

    const loaded = getLoadEffectiveManifest()({ cwd: child });
    const doc = documentOf(loaded);
    expect(doc.active).toEqual(["cursor"]);
    expect(localPathOf(loaded)).toBeUndefined();
  });

  test("apm.local.yml alone fails closed naming the unsupported file", () => {
    project = createTempProject();
    writeBaseManifest(project.cwd, conformingBase({ name: "apm-local-refuse" }));
    writeText(join(project.cwd, "apm.local.yml"), "active:\n  - cursor\n");

    expectThrowsMatching(
      () => getLoadEffectiveManifest()({ cwd: project!.cwd }),
      /apm\.local\.yml/i,
    );
  });

  test("apm.local.yml with bapm.local.yml still fails closed", () => {
    project = createTempProject();
    writeBaseManifest(project.cwd, conformingBase({ name: "dual-local-refuse" }));
    writeLocalOverlay(project.cwd, "active:\n  - cursor\n");
    writeText(join(project.cwd, "apm.local.yml"), "active:\n  - x-acme-editor\n");

    expectThrowsMatching(
      () => getLoadEffectiveManifest()({ cwd: project!.cwd }),
      /apm\.local\.yml/i,
    );
  });
});
