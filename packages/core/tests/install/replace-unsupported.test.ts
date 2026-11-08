/**
 * P1 parity: install must refuse a root replace: manifest before any write.
 */
import { describe, expect, test, afterEach } from "vite-plus/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  getRunInstall,
  lockPathCandidates,
  modulesDir,
  writeManifest,
  type TempProject,
} from "./helpers.ts";

describe("install replace: fail closed", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("replace: aborts install with no lock or modules written", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      [
        "name: install-replace",
        "version: 0.1.0",
        "dependencies:",
        "  apm: []",
        "replace:",
        "  - for:",
        "      git: https://github.com/acme/upstream.git",
        "    with:",
        "      git: https://github.com/acme/fork.git",
        "      ref: v1.2.3",
        "",
      ].join("\n"),
    );

    let thrown: unknown;
    try {
      await getRunInstall()({ cwd: project.cwd, noPolicy: true });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeTruthy();
    const err = thrown as { code?: string; message?: string };
    expect(err.code).toBe("MANIFEST_REPLACE_UNSUPPORTED");
    expect(err.message).toMatch(/acme\/fork/);
    expect(existsSync(modulesDir(project.cwd))).toBe(false);
    for (const lockPath of lockPathCandidates(project.cwd)) {
      expect(existsSync(lockPath)).toBe(false);
    }
    expect(existsSync(join(project.cwd, ".cursor"))).toBe(false);
  });
});
