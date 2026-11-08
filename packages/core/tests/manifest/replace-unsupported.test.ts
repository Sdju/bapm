/**
 * P1 parity: root `replace:` (APM 0.35 replacement rules) must fail closed.
 */
import { describe, expect, test, afterEach } from "vite-plus/test";
import { loadManifest } from "@b-apm/core";
import { createTempProject, writeManifest, type TempProject } from "./helpers.ts";

describe("manifest replace: unsupported", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("root replace: fails with MANIFEST_REPLACE_UNSUPPORTED naming the rule", () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      [
        "name: replace-project",
        "version: 0.1.0",
        "replace:",
        "  - for:",
        "      git: https://github.com/acme/upstream.git",
        "    with:",
        "      path: ./forks/upstream",
        "",
      ].join("\n"),
    );

    let thrown: unknown;
    try {
      loadManifest({ cwd: project.cwd });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeTruthy();
    const err = thrown as { code?: string; message?: string };
    expect(err.code).toBe("MANIFEST_REPLACE_UNSUPPORTED");
    expect(err.message).toMatch(/replace/i);
    expect(err.message).toMatch(/acme\/upstream/);
    expect(err.message).toMatch(/forks\/upstream/);
    expect(err.message).toMatch(/APM 0\.35\+/);
  });

  test("empty replace: list is a no-op (mirrors APM parse_replace_block)", () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      ["name: empty-replace", "version: 0.1.0", "replace: []", ""].join("\n"),
    );

    const { document } = loadManifest({ cwd: project.cwd });
    expect(document.name).toBe("empty-replace");
  });

  test("dependency manifest may retain replace: via allowReplace", () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      [
        "name: dependency-with-replace",
        "version: 0.1.0",
        "replace:",
        "  - for:",
        "      git: https://github.com/acme/upstream.git",
        "    with:",
        "      path: ./forks/upstream",
        "",
      ].join("\n"),
    );

    const { document } = loadManifest({ cwd: project.cwd, allowReplace: true });
    expect(Array.isArray(document.replace)).toBe(true);
  });
});
