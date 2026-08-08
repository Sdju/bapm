/**
 * Allowlist validation for bapm.local.yml
 * (promoted from manifest-local-overlay acceptance).
 */
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

describe("manifest-local-overlay — allowlist", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("allowlisted overlay (active / targets / env / registries) is accepted", () => {
    project = createTempProject();
    writeBaseManifest(project.cwd, conformingBase({ name: "allow-ok" }));
    writeLocalOverlay(
      project.cwd,
      [
        "active:",
        "  - cursor",
        "targets:",
        '  cursor: "@bapm/integration-cursor"',
        "env:",
        '  FOO: "bar"',
        "registries:",
        "  example:",
        '    url: "https://example.com/registry"',
        "",
      ].join("\n"),
    );

    const doc = documentOf(getLoadEffectiveManifest()({ cwd: project.cwd }));
    expect(doc.active).toEqual(["cursor"]);
    expect(doc.targets).toMatchObject({ cursor: "@bapm/integration-cursor" });
    expect(doc.env).toMatchObject({ FOO: "bar" });
    expect(doc.registries).toBeTruthy();
  });

  test("forbidden dependencies key is rejected", () => {
    project = createTempProject();
    writeBaseManifest(project.cwd, conformingBase({ name: "forbid-deps" }));
    writeLocalOverlay(
      project.cwd,
      ["dependencies:", "  apm:", "    - github.com/example/pkg", ""].join("\n"),
    );

    expectThrowsMatching(
      () => getLoadEffectiveManifest()({ cwd: project!.cwd }),
      /dependencies|disallowed|forbidden|allowlist|not allowed|unknown/i,
    );
  });

  test("forbidden name key is rejected", () => {
    project = createTempProject();
    writeBaseManifest(project.cwd, conformingBase({ name: "forbid-name" }));
    writeLocalOverlay(project.cwd, "name: hijacked\nactive:\n  - cursor\n");

    expectThrowsMatching(
      () => getLoadEffectiveManifest()({ cwd: project!.cwd }),
      /name|disallowed|forbidden|allowlist|not allowed|unknown/i,
    );
  });

  test("unknown top-level key is rejected", () => {
    project = createTempProject();
    writeBaseManifest(project.cwd, conformingBase({ name: "forbid-unknown" }));
    writeLocalOverlay(project.cwd, "x-custom: true\n");

    expectThrowsMatching(
      () => getLoadEffectiveManifest()({ cwd: project!.cwd }),
      /x-custom|disallowed|forbidden|allowlist|not allowed|unknown/i,
    );
  });
});
