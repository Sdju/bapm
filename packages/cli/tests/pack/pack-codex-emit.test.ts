/**
 * G6 / marketplace-pack-outputs — Codex emit requires category; missing fails closed.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  assertTrailingNewlineIndent2,
  codexMarketplacePath,
  createTempProject,
  expectKnownCommand,
  hasCodexMarketplaceJson,
  parseJsonFile,
  readText,
  runInProject,
  type TempProject,
  writeCodexLocalAuthoring,
} from "./pack-outputs-helpers.ts";

describe("mp-pack-outputs CLI Codex emit", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("Codex output with category writes .agents/plugins/marketplace.json", async () => {
    project = createTempProject();
    writeCodexLocalAuthoring(project.cwd, { category: "tools" });

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--marketplace",
      "codex",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(0);
    expect(hasCodexMarketplaceJson(project.cwd)).toBe(true);

    const raw = readText(project.cwd, ".agents/plugins/marketplace.json");
    assertTrailingNewlineIndent2(raw);
    const doc = parseJsonFile(codexMarketplacePath(project.cwd)) as Record<string, unknown>;
    expect(doc.name).toBe("codex-mp");
    const iface = doc.interface as Record<string, unknown> | undefined;
    expect(iface?.displayName ?? doc.displayName).toBeTruthy();
    const plugins = doc.plugins as Record<string, unknown>[];
    expect(plugins.some((p) => p.category === "tools")).toBe(true);
    for (const p of plugins) {
      expect(p).toHaveProperty("source");
      expect(p).toHaveProperty("policy");
      expect(p).toHaveProperty("category");
    }
  });

  test("Codex output without category fails closed — no durable Codex JSON", async () => {
    project = createTempProject();
    writeCodexLocalAuthoring(project.cwd, { category: null });

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--marketplace",
      "codex",
    ]);
    expectKnownCommand(combined, "pack");
    expect(combined).not.toMatch(/Unknown pack flag:\s*--marketplace\b/i);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/categor/i);
    expect(hasCodexMarketplaceJson(project.cwd)).toBe(false);
  });
});
