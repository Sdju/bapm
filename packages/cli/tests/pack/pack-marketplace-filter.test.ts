/**
 * G6 — --marketplace none skips host JSON; filter / unknown format fail-closed.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  hasAnyHostMarketplaceJson,
  hasClaudeMarketplaceJson,
  runInProject,
  type TempProject,
  writeClaudeLocalAuthoring,
} from "./pack-outputs-helpers.ts";

describe("mp-pack-outputs CLI --marketplace filter", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("--marketplace none skips host marketplace.json even with marketplace: block", async () => {
    project = createTempProject();
    writeClaudeLocalAuthoring(project.cwd);

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--archive",
      "--marketplace",
      "none",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(0);
    expect(hasClaudeMarketplaceJson(project.cwd)).toBe(false);
    expect(hasAnyHostMarketplaceJson(project.cwd)).toBe(false);
  });

  test("unknown --marketplace format fails closed without writing JSON", async () => {
    project = createTempProject();
    writeClaudeLocalAuthoring(project.cwd);

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--marketplace",
      "not-a-host",
    ]);
    expectKnownCommand(combined, "pack");
    expect(combined).not.toMatch(/Unknown pack flag:\s*--marketplace\b/i);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/not-a-host|unknown.*marketplace|unknown.*format/i);
    expect(hasAnyHostMarketplaceJson(project.cwd)).toBe(false);
  });
});
