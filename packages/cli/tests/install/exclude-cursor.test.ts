/**
 * CLI install UX: --exclude cursor skips .cursor/mcp.json writes.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync } from "node:fs";
import {
  createTempProject,
  expectKnownCommand,
  expectKnownFlags,
  mcpJsonPath,
  runInProject,
  writeMcpProject,
  type TempProject,
} from "./helpers.ts";

describe("CLI install --exclude cursor", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("exclude cursor leaves mcp.json untouched while install may succeed", async () => {
    project = createTempProject();
    writeMcpProject(project.cwd, "cli-exclude-mcp");
    expect(existsSync(mcpJsonPath(project.cwd))).toBe(false);

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--exclude",
      "cursor",
      "--target",
      "cursor",
    ]);

    expectKnownCommand(combined, "install");
    expectKnownFlags(combined);
    expect(combined).not.toMatch(/Unknown install flag:\s*--exclude/i);
    expect(result).toBe(0);
    expect(existsSync(mcpJsonPath(project.cwd))).toBe(false);
  });
});
