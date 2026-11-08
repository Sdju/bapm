/**
 * CLI install surfaces LIFECYCLE_UNSUPPORTED warning names once per package.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  linkCursorIntegration,
  runInProject,
  writeText,
  type TempProject,
} from "./helpers.ts";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

describe("CLI install lifecycle warning", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("root and dependency lifecycle warn once each and install continues", async () => {
    project = createTempProject();
    linkCursorIntegration(project.cwd);
    writeText(
      project.cwd,
      "bapm.yml",
      [
        "name: lifecycle-cli-root",
        "version: 0.0.1",
        "active:",
        "  target: cursor",
        "lifecycle:",
        "  postinstall: write-marker",
        "dependencies:",
        "  apm:",
        "    - path: ./leaf",
        "",
      ].join("\n"),
    );
    mkdirSync(join(project.cwd, "leaf"), { recursive: true });
    writeText(
      project.cwd,
      "leaf/bapm.yml",
      [
        "name: lifecycle-cli-leaf",
        "version: 0.0.1",
        "lifecycle:",
        "  test: write-marker",
        "dependencies:",
        "  apm: []",
        "",
      ].join("\n"),
    );

    const { result, stderr } = await runInProject(project.cwd, [
      "install",
      "--no-frozen",
      "--no-policy",
    ]);

    expect(result).toBe(0);
    const text = stderr.join("\n");
    expect(text.match(/LIFECYCLE_UNSUPPORTED/g)).toHaveLength(2);
    expect(text).toMatch(/lifecycle-cli-root/);
    expect(text).toMatch(/lifecycle-cli-leaf/);
  });
});
