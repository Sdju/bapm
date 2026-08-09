/**
 * Acceptance (RED): overlay merge re-validates effective env (env-safe keys).
 * OpenSpec change: manifest-env-bake / manifest-yaml-validate
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  conformingBase,
  createTempProject,
  documentOf,
  expectLoadReject,
  getLoadEffectiveManifest,
  writeBaseManifest,
  writeLocalOverlay,
  type TempProject,
} from "./helpers.ts";

describe("manifest-env-bake — overlay env re-validation", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("base + local env deep-merge still loads with env-safe keys", () => {
    project = createTempProject();
    writeBaseManifest(
      project.cwd,
      conformingBase({
        name: "env-merge-ok",
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

    const message = expectLoadReject(project.cwd);
    expect(message).toMatch(/env|1BAD|key/i);
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

    const message = expectLoadReject(project.cwd);
    expect(message).toMatch(/env/i);
  });
});
