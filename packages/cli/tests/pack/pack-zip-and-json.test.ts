/**
 * G6 5.2 — packable project: zip + Claude JSON; dry-run leaves neither.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { readFileSync } from "node:fs";
import {
  createTempProject,
  expectKnownCommand,
  findZipUnder,
  hasClaudeMarketplaceJson,
  runInProject,
  type TempProject,
  writeClaudeLocalAuthoring,
  writeText,
} from "./pack-outputs-helpers.ts";

describe("mp-pack-outputs CLI packable zip + marketplace JSON", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("pack --archive with marketplace writes zip and Claude JSON", async () => {
    project = createTempProject();
    writeClaudeLocalAuthoring(project.cwd, { withManifestDeps: true });
    writeText(project.cwd, ".apm/keep.txt", "packed\n");

    const { result, combined } = await runInProject(project.cwd, ["pack", "--archive"]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(0);

    const zip = findZipUnder(project.cwd);
    expect(zip, "expected durable zip under project cwd").toBeTruthy();
    const magic = readFileSync(zip!).subarray(0, 2).toString("utf8");
    expect(magic).toBe("PK");
    expect(hasClaudeMarketplaceJson(project.cwd)).toBe(true);
  });

  test("pack --dry-run reports marketplace paths and leaves no durable zip or JSON", async () => {
    project = createTempProject();
    writeClaudeLocalAuthoring(project.cwd);
    writeText(project.cwd, ".apm/keep.txt", "packed\n");

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--archive",
      "--dry-run",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(0);
    expect(combined).toMatch(/marketplace\.json|\.claude-plugin/i);
    expect(findZipUnder(project.cwd)).toBeUndefined();
    expect(hasClaudeMarketplaceJson(project.cwd)).toBe(false);
  });
});
