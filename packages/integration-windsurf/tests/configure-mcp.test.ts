/**
 * configureMcp → home ~/.codeium/windsurf/mcp_config.json (CODEIUM_HOME)
 * with client-adapter mcpServers parity; preserve unrelated servers;
 * never project MCP / global_rules.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, loadWindsurfIntegration, readJson, writeJson } from "./helpers.ts";

type WindsurfMcpDoc = {
  mcpServers?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};

describe("windsurf configureMcp → home mcp_config.json", () => {
  let cleanup: (() => void) | undefined;
  let previousCodeiumHome: string | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    if (previousCodeiumHome === undefined) {
      delete process.env.CODEIUM_HOME;
    } else {
      process.env.CODEIUM_HOME = previousCodeiumHome;
    }
    previousCodeiumHome = undefined;
  });

  function withTempCodeiumHome(): { cwd: string; windsurfHome: string } {
    const project = createTempProject("bapm-windsurf-mcp-");
    cleanup = project.cleanup;
    previousCodeiumHome = process.env.CODEIUM_HOME;
    const codeiumHome = join(project.cwd, "codeium-home");
    mkdirSync(codeiumHome, { recursive: true });
    process.env.CODEIUM_HOME = codeiumHome;
    return { cwd: project.cwd, windsurfHome: join(codeiumHome, "windsurf") };
  }

  test("writes mcpServers stdio entry under CODEIUM_HOME/windsurf/mcp_config.json", async () => {
    const { cwd, windsurfHome } = withTempCodeiumHome();

    const target = loadWindsurfIntegration();
    const report = await target.configureMcp!(
      [
        {
          name: "test-stdio-server",
          transport: "stdio",
          type: "stdio",
          command: "echo",
          args: ["--greeting", "hello"],
        },
      ],
      { cwd, deployRoots: target.deployRoots, targetId: "windsurf" },
    );

    const path = join(windsurfHome, "mcp_config.json");
    expect(existsSync(path)).toBe(true);
    expect(String(report.configPath).length).toBeGreaterThan(0);
    expect(
      report.configPath === path ||
        report.configPath.endsWith("mcp_config.json") ||
        report.configPath.includes(".codeium/windsurf/mcp_config.json"),
    ).toBe(true);

    const doc = readJson(path) as WindsurfMcpDoc;
    expect(doc.mcpServers).toHaveProperty("test-stdio-server");
    const server = doc.mcpServers!["test-stdio-server"]!;
    expect(server.command === "echo" || server.type === "stdio").toBe(true);
    expect(existsSync(join(cwd, ".windsurf", "mcp.json"))).toBe(false);
    expect(existsSync(join(cwd, ".mcp.json"))).toBe(false);
    expect(existsSync(join(windsurfHome, "memories", "global_rules.md"))).toBe(false);
  });

  test("existing unrelated servers and top-level keys are preserved", async () => {
    const { cwd, windsurfHome } = withTempCodeiumHome();
    mkdirSync(windsurfHome, { recursive: true });
    writeJson(join(windsurfHome, "mcp_config.json"), {
      meta: "keep-me",
      mcpServers: {
        manual: { type: "stdio", command: "manual-bin" },
      },
    });

    const target = loadWindsurfIntegration();
    await target.configureMcp!(
      [{ name: "owned", transport: "stdio", command: "node", args: ["server.mjs"] }],
      { cwd, deployRoots: target.deployRoots, targetId: "windsurf" },
    );

    const doc = readJson(join(windsurfHome, "mcp_config.json")) as WindsurfMcpDoc;
    expect(doc.meta).toBe("keep-me");
    expect(doc.mcpServers).toHaveProperty("manual");
    expect(doc.mcpServers).toHaveProperty("owned");
  });

  test("does not declare translate mcpEnvMode", async () => {
    const { cwd } = withTempCodeiumHome();
    const target = loadWindsurfIntegration();
    expect((target as { mcpEnvMode?: string }).mcpEnvMode).not.toBe("translate");
    await target.configureMcp!(
      [{ name: "baked", transport: "stdio", command: "node", env: { TOKEN: "literal-ok" } }],
      { cwd, deployRoots: target.deployRoots, targetId: "windsurf" },
    );
  });
});
