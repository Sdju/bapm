/**
 * configureMcp → .agents/mcp_config.json opt-in; serverUrl for remote; no ~/.gemini.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, loadAntigravityIntegration, readJson, writeJson } from "./helpers.ts";

type McpDoc = {
  mcpServers?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};

describe("antigravity configureMcp", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("writes mcpServers when .agents/ exists", async () => {
    const project = createTempProject("bapm-agy-mcp-write-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".agents"), { recursive: true });

    const target = loadAntigravityIntegration();
    const configure = target.configureMcp;
    if (!configure) throw new Error("antigravity must expose configureMcp");

    const report = await configure(
      [
        {
          name: "demo",
          transport: "stdio",
          command: "npx",
          args: ["-y", "demo"],
        },
      ],
      { cwd: project.cwd, deployRoots: target.deployRoots, targetId: "antigravity" },
    );

    const path = join(project.cwd, ".agents", "mcp_config.json");
    expect(existsSync(path)).toBe(true);
    expect(report.configPath).toMatch(/mcp_config\.json/);
    const doc = readJson(path) as McpDoc;
    expect(doc.mcpServers).toHaveProperty("demo");
    expect(doc.mcpServers!.demo!.command).toBe("npx");
    expect(existsSync(join(project.cwd, ".agents", "settings.json"))).toBe(false);
  });

  test("skips when .agents/ is absent and does not invent the directory", async () => {
    const project = createTempProject("bapm-agy-mcp-skip-");
    cleanup = project.cleanup;

    const target = loadAntigravityIntegration();
    const configure = target.configureMcp;
    if (!configure) throw new Error("antigravity must expose configureMcp");

    const report = await configure([{ name: "demo", transport: "stdio", command: "echo" }], {
      cwd: project.cwd,
      deployRoots: target.deployRoots,
      targetId: "antigravity",
    });

    expect(existsSync(join(project.cwd, ".agents"))).toBe(false);
    expect(existsSync(join(project.cwd, ".agents", "mcp_config.json"))).toBe(false);
    expect((report.diagnostics ?? []).length).toBeGreaterThan(0);
    expect(report.servers ?? []).toEqual([]);
  });

  test("remote servers use serverUrl", async () => {
    const project = createTempProject("bapm-agy-mcp-url-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".agents"), { recursive: true });

    const target = loadAntigravityIntegration();
    await target.configureMcp!(
      [
        {
          name: "remote",
          transport: "http",
          url: "https://example.com/mcp",
        },
      ],
      { cwd: project.cwd, deployRoots: target.deployRoots, targetId: "antigravity" },
    );

    const doc = readJson(join(project.cwd, ".agents", "mcp_config.json")) as McpDoc;
    const entry = doc.mcpServers!.remote!;
    expect(entry.serverUrl).toBe("https://example.com/mcp");
    expect(entry).not.toHaveProperty("url");
    expect(entry).not.toHaveProperty("httpUrl");
  });

  test("preserves unrelated servers and does not write ~/.gemini", async () => {
    const project = createTempProject("bapm-agy-mcp-preserve-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".agents"), { recursive: true });
    writeJson(join(project.cwd, ".agents", "mcp_config.json"), {
      theme: "keep",
      mcpServers: {
        keep: { command: "keep-cmd" },
      },
    });
    const prevHome = process.env.HOME;
    const fakeHome = join(project.cwd, "home");
    mkdirSync(fakeHome, { recursive: true });
    process.env.HOME = fakeHome;

    try {
      const target = loadAntigravityIntegration();
      await target.configureMcp!([{ name: "owned", transport: "stdio", command: "owned-cmd" }], {
        cwd: project.cwd,
        deployRoots: target.deployRoots,
        targetId: "antigravity",
      });
      const doc = readJson(join(project.cwd, ".agents", "mcp_config.json")) as McpDoc;
      expect(doc.theme).toBe("keep");
      expect(doc.mcpServers!.keep!.command).toBe("keep-cmd");
      expect(doc.mcpServers!.owned!.command).toBe("owned-cmd");
      expect(existsSync(join(fakeHome, ".gemini"))).toBe(false);
    } finally {
      if (prevHome === undefined) delete process.env.HOME;
      else process.env.HOME = prevHome;
    }
  });
});
