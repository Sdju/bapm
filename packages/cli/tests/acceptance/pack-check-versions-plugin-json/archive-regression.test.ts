/**
 * producer-pack-archive — --check-versions must stay orthogonal to M7 archive success.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { readFileSync } from "node:fs";
import {
  createTempProject,
  expectKnownCommand,
  findZipUnder,
  runInProject,
  writeConformingManifest,
  type TempProject,
} from "./helpers.ts";

describe("pack-check-versions-plugin-json — archive without gate", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("pack --archive without --check-versions still succeeds (plain zip)", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd, { name: "cli-pack", version: "1.2.3" });

    const { result, combined } = await runInProject(project.cwd, ["pack", "--archive"]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(0);

    const zip = findZipUnder(project.cwd);
    expect(zip, "expected zip under project cwd").toBeTruthy();
    const magic = readFileSync(zip!).subarray(0, 2).toString("utf8");
    expect(magic).toBe("PK");
  });
});
