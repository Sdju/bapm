/**
 * Per-field merge rules: active replace, targets/env/registries deep-merge
 * (promoted from manifest-local-overlay / manifest-env-bake acceptance).
 */
import { asText } from "../asText.ts";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  conformingBase,
  createTempProject,
  documentOf,
  expectThrowsMatching,
  getLoadEffectiveManifest,
  writeBaseManifest,
  writeLocalOverlay,
  type TempProject,
} from "./local-overlay-helpers.ts";

describe("manifest-local-overlay — merge rules", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("active list is replaced (not appended) when local sets active", () => {
    project = createTempProject();
    writeBaseManifest(
      project.cwd,
      conformingBase({
        name: "active-replace",
        extraYaml: "active:\n  - cursor\n",
      }),
    );
    writeLocalOverlay(project.cwd, "active:\n  - x-acme-editor\n");

    const doc = documentOf(getLoadEffectiveManifest()({ cwd: project.cwd }));
    expect(doc.active).toEqual(["x-acme-editor"]);
  });

  test("targets object-map keys deep-merge with local winning per key", () => {
    project = createTempProject();
    writeBaseManifest(
      project.cwd,
      conformingBase({
        name: "targets-merge",
        extraYaml: ["targets:", '  cursor: "@b-apm/integration-cursor"', ""].join("\n"),
      }),
    );
    writeLocalOverlay(
      project.cwd,
      ["targets:", '  x-acme-editor: "@scope/acme-integration"', ""].join("\n"),
    );

    const doc = documentOf(getLoadEffectiveManifest()({ cwd: project.cwd }));
    expect(doc.targets).toMatchObject({
      cursor: "@b-apm/integration-cursor",
      "x-acme-editor": "@scope/acme-integration",
    });
  });

  test("env keys deep-merge with local winning per key", () => {
    project = createTempProject();
    writeBaseManifest(
      project.cwd,
      conformingBase({
        name: "env-merge",
        extraYaml: ["env:", '  FOO: "base"', '  BAR: "keep"', ""].join("\n"),
      }),
    );
    writeLocalOverlay(project.cwd, 'env:\n  FOO: "local"\n');

    const doc = documentOf(getLoadEffectiveManifest()({ cwd: project.cwd }));
    expect(doc.env).toMatchObject({ FOO: "local", BAR: "keep" });
  });

  test("invalid env-safe key in overlay fails closed on effective load", () => {
    project = createTempProject();
    writeBaseManifest(
      project.cwd,
      conformingBase({
        name: "env-overlay-bad-key",
        extraYaml: ["env:", '  GOOD: "ok"', ""].join("\n"),
      }),
    );
    writeLocalOverlay(project.cwd, 'env:\n  "1BAD": "nope"\n');

    expectThrowsMatching(() => getLoadEffectiveManifest()({ cwd: project!.cwd }), /env|1BAD|key/i);
  });

  test("invalid env shape in base manifest fails closed", () => {
    project = createTempProject();
    writeBaseManifest(
      project.cwd,
      conformingBase({
        name: "env-base-list",
        extraYaml: ["env:", "  - FOO=bar", ""].join("\n"),
      }),
    );

    expectThrowsMatching(() => getLoadEffectiveManifest()({ cwd: project!.cwd }), /env/i);
  });

  test("registries deep-merge by name with local overlaying that entry", () => {
    project = createTempProject();
    writeBaseManifest(
      project.cwd,
      conformingBase({
        name: "reg-merge",
        extraYaml: [
          "registries:",
          "  keep:",
          '    url: "https://keep.example/registry"',
          "  overwrite:",
          '    url: "https://old.example/registry"',
          "",
        ].join("\n"),
      }),
    );
    writeLocalOverlay(
      project.cwd,
      [
        "registries:",
        "  overwrite:",
        '    url: "https://new.example/registry"',
        "  added:",
        '    url: "https://added.example/registry"',
        "",
      ].join("\n"),
    );

    const doc = documentOf(getLoadEffectiveManifest()({ cwd: project.cwd }));
    const regs = doc.registries as Record<string, unknown>;
    expect(regs).toBeTruthy();
    expect(regs.keep).toBeTruthy();
    expect(regs.added).toBeTruthy();
    const overwrite = regs.overwrite;
    const overwriteUrl =
      typeof overwrite === "string"
        ? overwrite
        : overwrite && typeof overwrite === "object"
          ? asText((overwrite as { url?: unknown }).url ?? "")
          : "";
    expect(overwriteUrl).toMatch(/new\.example/);
  });
});
