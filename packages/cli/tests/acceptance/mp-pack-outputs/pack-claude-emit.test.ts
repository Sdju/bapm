/**
 * G6 / marketplace-pack-outputs — local packages → Claude marketplace.json emit.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  assertTrailingNewlineIndent2,
  claudeMarketplacePath,
  createTempProject,
  expectKnownCommand,
  hasClaudeMarketplaceJson,
  parseJsonFile,
  readFileSync,
  readText,
  runInProject,
  type TempProject,
  writeClaudeLocalAuthoring,
} from "./helpers.ts";

describe("mp-pack-outputs CLI Claude emit (local packages)", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("pack writes Claude marketplace.json for local ./ package", async () => {
    project = createTempProject();
    writeClaudeLocalAuthoring(project.cwd);

    const { result, combined } = await runInProject(project.cwd, ["pack"]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(0);
    expect(hasClaudeMarketplaceJson(project.cwd)).toBe(true);

    const raw = readText(project.cwd, ".claude-plugin/marketplace.json");
    assertTrailingNewlineIndent2(raw);
    const doc = parseJsonFile(claudeMarketplacePath(project.cwd)) as Record<string, unknown>;
    expect(doc.name).toBe("acme-mp");
    expect(Array.isArray(doc.plugins)).toBe(true);
    const plugins = doc.plugins as Record<string, unknown>[];
    expect(plugins.length).toBeGreaterThanOrEqual(1);
    const demo = plugins.find((p) => p.name === "demo");
    expect(demo, "expected plugin entry named demo").toBeTruthy();
    expect(demo!.source).toMatch(/^\.?\/?plugins\/demo/);
    expect(demo).not.toHaveProperty("tag_pattern");
    expect(demo).not.toHaveProperty("include_prerelease");
    expect(demo).not.toHaveProperty("isLocal");
    expect(demo).not.toHaveProperty("is_local");
  });

  test("pack --marketplace-path overrides Claude path under project root", async () => {
    project = createTempProject();
    writeClaudeLocalAuthoring(project.cwd);

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--marketplace",
      "claude",
      "--marketplace-path",
      "claude=nested/out/marketplace.json",
    ]);
    expectKnownCommand(combined, "pack");
    expect(combined).not.toMatch(/Unknown pack flag:\s*--marketplace(-path)?\b/i);
    expect(result).toBe(0);
    expect(hasClaudeMarketplaceJson(project.cwd)).toBe(false);
    const raw = readFileSync(`${project.cwd}/nested/out/marketplace.json`, "utf8");
    expect(raw).toMatch(/"plugins"/);
    assertTrailingNewlineIndent2(raw);
  });
});
