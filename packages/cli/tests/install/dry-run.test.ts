/**
 * CLI install UX: --dry-run previews without durable writes.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  expectKnownFlags,
  fingerprintProject,
  hasLockfile,
  hasModules,
  readManifestText,
  runInProject,
  writeLeafProject,
  type TempProject,
} from "./helpers.ts";

describe("CLI install --dry-run", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("bapm install --dry-run previews without writes", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-dry-run", { withCursor: true });
    const before = fingerprintProject(project.cwd);

    const { result, combined } = await runInProject(project.cwd, ["install", "--dry-run"]);

    expectKnownCommand(combined, "install");
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(combined).toMatch(/dry.?run|preview|no changes|would/i);
    expect(fingerprintProject(project.cwd)).toBe(before);
    expect(hasLockfile(project.cwd)).toBe(false);
    expect(hasModules(project.cwd)).toBe(false);
  });

  test("dry-run positional previews without writing manifest", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-dry-pos", { withCursor: true });
    const before = fingerprintProject(project.cwd);
    const manifestBefore = readManifestText(project.cwd);

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--dry-run",
      "./extra",
    ]);

    expectKnownCommand(combined, "install");
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(combined).toMatch(/extra|would|add|preview|dry.?run/i);
    expect(readManifestText(project.cwd)).toBe(manifestBefore);
    expect(fingerprintProject(project.cwd)).toBe(before);
  });
});
