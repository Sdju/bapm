import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createMarketplaceOutputRegistry,
  createTargetRegistry,
  type MarketplaceOutputIntegration,
  type MarketplaceOutputRegistry,
} from "bapm-integration-api";
import { createCursorTarget } from "bapm-integration-cursor";
import {
  buildMarketplaceOutputs,
  resolveEffectiveOutputPath,
  type MarketplaceAuthoringConfig,
} from "@bapm/core";

async function loadMarketplaceIntegrations(): Promise<{
  claude: MarketplaceOutputIntegration;
  codex: MarketplaceOutputIntegration;
}> {
  const claudeSpecifier = ["bapm", "integration", "claude"].join("-");
  const codexSpecifier = ["bapm", "integration", "codex"].join("-");
  const claude = (await import(claudeSpecifier)) as {
    claudeMarketplaceIntegration: MarketplaceOutputIntegration;
  };
  const codex = (await import(codexSpecifier)) as {
    codexMarketplaceIntegration: MarketplaceOutputIntegration;
  };
  return {
    claude: claude.claudeMarketplaceIntegration,
    codex: codex.codexMarketplaceIntegration,
  };
}

async function createMarketplaceRegistry(): Promise<MarketplaceOutputRegistry> {
  const { claude, codex } = await loadMarketplaceIntegrations();
  const registry = createMarketplaceOutputRegistry();
  registry.register(claude);
  registry.register(codex);
  return registry;
}

describe("integration migration public behavior", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("preserves Cursor runtime behavior through the registered integration", async () => {
    const project = mkdtempSync(join(tmpdir(), "bapm-integration-cursor-"));
    cwd = project;
    const cursor = createCursorTarget();
    const registry = createTargetRegistry();
    registry.register(cursor);

    expect((await registry.detect(project)).detectedIds).toEqual([]);
    await cursor.materialize(
      [{ name: "demo", type: "skill", source: "local", path: "", content: "# Demo\n" }],
      { cwd: project, targetId: cursor.id, deployRoots: cursor.deployRoots },
    );
    expect(readFileSync(join(project, ".agents", "skills", "demo", "SKILL.md"), "utf8")).toBe(
      "# Demo\n",
    );

    const report = await cursor.configureMcp?.(
      [{ name: "local", command: "node", args: ["server.mjs"] }],
      { cwd: project, targetId: cursor.id, deployRoots: cursor.deployRoots },
    );
    expect(report).toMatchObject({
      targetId: "cursor",
      configPath: ".cursor/mcp.json",
      deployedFiles: [{ path: ".cursor/mcp.json" }],
    });
    expect(JSON.parse(readFileSync(join(project, ".cursor", "mcp.json"), "utf8"))).toMatchObject({
      mcpServers: { local: { command: "node", args: ["server.mjs"], type: "stdio" } },
    });

    const compiled = await cursor.compile?.([], { cwd: project, write: true });
    expect(compiled).toMatchObject({ path: "AGENTS.md", wrote: true });
    expect(existsSync(join(project, "AGENTS.md"))).toBe(true);
    await expect(
      cursor.materialize([], { cwd: project, targetId: cursor.id, deployRoots: [".outside"] }),
    ).rejects.toThrow(/deploy root/);
  });

  test("uses host-owned marketplace mappings, defaults, validation, and path jail", async () => {
    const project = mkdtempSync(join(tmpdir(), "bapm-integration-marketplace-"));
    cwd = project;
    const registry = await createMarketplaceRegistry();
    const config: MarketplaceAuthoringConfig = {
      name: "acme",
      owner: "Acme",
      packages: [
        {
          name: "demo",
          source: "./plugins/demo",
          category: "development",
          isLocal: true,
          is_local: true,
        },
      ],
      outputs: { claude: true, codex: true },
    };

    expect(registry.get("claude")?.marketplaceOutput.defaultOutput).toBe(
      ".claude-plugin/marketplace.json",
    );
    expect(registry.get("codex")?.marketplaceOutput.defaultOutput).toBe(
      ".agents/plugins/marketplace.json",
    );
    const result = await buildMarketplaceOutputs({
      cwd: project,
      config,
      marketplaceOutputs: registry,
      marketplace: "all",
    });
    expect(result.written).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          format: "claude",
          path: join(project, ".claude-plugin/marketplace.json"),
        }),
        expect.objectContaining({
          format: "codex",
          path: join(project, ".agents/plugins/marketplace.json"),
        }),
      ]),
    );
    expect(
      JSON.parse(readFileSync(join(project, ".claude-plugin", "marketplace.json"), "utf8")),
    ).toMatchObject({
      owner: { name: "Acme" },
      plugins: [{ name: "demo", source: "./plugins/demo" }],
    });
    expect(
      JSON.parse(readFileSync(join(project, ".agents", "plugins", "marketplace.json"), "utf8")),
    ).toMatchObject({
      plugins: [{ name: "demo", category: "development" }],
    });
    expect(() =>
      resolveEffectiveOutputPath({
        cwd: project,
        format: "codex",
        defaultOutput: ".agents/plugins/marketplace.json",
        path: "../outside.json",
      }),
    ).toThrow(/path jail/);
    const { codex } = await loadMarketplaceIntegrations();
    expect(() =>
      codex.marketplaceOutput.map({ name: "acme" }, [
        { name: "missing-category", entry: {}, isLocal: true, source: "./plugins/missing" },
      ]),
    ).toThrow(/category required/i);
  });

  test("emits marketplace-only output without a runtime integration", async () => {
    const project = mkdtempSync(join(tmpdir(), "bapm-integration-marketplace-only-"));
    cwd = project;
    const registry = createMarketplaceOutputRegistry();
    registry.register((await loadMarketplaceIntegrations()).codex);

    const result = await buildMarketplaceOutputs({
      cwd: project,
      marketplace: "codex",
      marketplaceOutputs: registry,
      config: {
        name: "codex-only",
        owner: "Acme",
        packages: [
          {
            name: "demo",
            source: "./plugins/demo",
            category: "development",
            isLocal: true,
            is_local: true,
          },
        ],
        outputs: { codex: true },
      },
    });

    expect(result.written).toEqual([
      expect.objectContaining({
        format: "codex",
        path: join(project, ".agents/plugins/marketplace.json"),
      }),
    ]);
    expect(existsSync(join(project, ".agents", "plugins", "marketplace.json"))).toBe(true);
  });
});
