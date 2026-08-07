/**
 * Acceptance: Agent Plugins portable MCP path stays separate from consumer bake.
 * OpenSpec change: mcp-env-bake-time (boundary / non-goal)
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AGENT_PLUGIN_MANIFEST_SCHEMA_V1, discoverAgentPluginMcp } from "@bapm/core";

describe("mcp-env-bake-time Agent Plugins boundary", () => {
  let root: string | undefined;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  function createPortablePlugin(): string {
    const dir = mkdtempSync(join(tmpdir(), "bapm-mcp-bake-ap-"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "plugin.json"),
      JSON.stringify({
        $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
        name: "portable-bake-boundary",
      }),
      "utf8",
    );
    return dir;
  }

  test("portable mcp.json secret-like env keys still refuse independently of bake", () => {
    root = createPortablePlugin();
    writeFileSync(
      join(root, "mcp.json"),
      JSON.stringify({
        mcpServers: {
          unsafe: {
            type: "stdio",
            command: "node",
            args: ["server.mjs"],
            env: { API_TOKEN: "should-refuse" },
          },
        },
      }),
      "utf8",
    );

    const mcp = discoverAgentPluginMcp({ root, dataRoot: join(root, ".data") });
    expect(mcp.servers).toEqual([]);
    expect(mcp.diagnostics.map((d) => d.code)).toEqual(
      expect.arrayContaining(["AGENT_PLUGIN_MCP_SECRET_REFUSED"]),
    );
  });

  test("portable ${PLUGIN_ROOT} substitution still applies (not consumer ${VAR} bake)", () => {
    root = createPortablePlugin();
    writeFileSync(
      join(root, "mcp.json"),
      JSON.stringify({
        mcpServers: {
          stdio: {
            type: "stdio",
            command: "node",
            args: ["${PLUGIN_ROOT}/bin/server"],
            cwd: ".",
          },
        },
      }),
      "utf8",
    );

    const mcp = discoverAgentPluginMcp({ root, dataRoot: join(root, ".data") });
    expect(mcp.servers).toHaveLength(1);
    expect(mcp.servers[0]?.env?.PLUGIN_ROOT).toBe(root);
    expect(mcp.servers[0]?.args?.[0]).toBe(join(root, "bin/server"));
  });
});
