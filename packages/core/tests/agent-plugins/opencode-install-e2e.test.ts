/**
 * Agent Plugins delta: packed portable plugin installs into OpenCode host
 * (promoted from integration-opencode-runtime acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createIntegrationRegistry } from "@bapm/integration-api";
import { createOpencodeIntegration } from "@bapm/integration-opencode";
import { extractPackArchive, runInstall, runPack, writeAgentPluginManifest } from "@bapm/core";

describe("Agent Plugins · OpenCode install e2e", () => {
  let project: string | undefined;

  afterEach(() => {
    if (project) rmSync(project, { recursive: true, force: true });
    project = undefined;
  });

  test("packed portable plugin installs skills under .opencode/skills and MCP under opencode.json", async () => {
    project = join(tmpdir(), `bapm-oc-e2e-${Date.now()}`);
    const producer = join(project, "producer");
    const consumer = join(project, "consumer");
    const plugin = join(consumer, "plugin");
    mkdirSync(producer, { recursive: true });
    writeAgentPluginManifest({ root: producer, name: "e2e-opencode-plugin", version: "1.0.0" });
    const skillDir = join(producer, "skills", "e2e-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: e2e-skill\n---\n# E2E\n", "utf8");
    writeFileSync(join(skillDir, "references.md"), "# Reference\n", "utf8");
    writeFileSync(
      join(producer, "mcp.json"),
      JSON.stringify({
        mcpServers: {
          stdio: { type: "stdio", command: "node", args: ["${PLUGIN_ROOT}/server.mjs"] },
          http: { type: "streamable-http", url: "https://example.test/mcp" },
          sse: { type: "sse", url: "https://example.test/sse" },
        },
      }),
      "utf8",
    );

    const packed = await runPack({ cwd: producer, archive: true, agentPlugins: true });
    await extractPackArchive({ archivePath: packed.archivePath, outputDir: plugin });
    mkdirSync(join(consumer, ".opencode"), { recursive: true });
    writeFileSync(
      join(consumer, "bapm.yml"),
      [
        "name: consumer",
        'version: "1.0.0"',
        "targets:",
        '  opencode: "@bapm/integration-opencode"',
        "dependencies:",
        "  apm:",
        "    - path: ./plugin",
        "",
      ].join("\n"),
      "utf8",
    );

    const target = createOpencodeIntegration();
    const registry = createIntegrationRegistry();
    registry.register(target);

    await runInstall({ cwd: consumer, integrationRegistry: registry, registry });

    expect(
      readFileSync(join(consumer, ".opencode", "skills", "e2e-skill", "references.md"), "utf8"),
    ).toBe("# Reference\n");
    expect(existsSync(join(consumer, ".opencode", "skills", "e2e-skill", "SKILL.md"))).toBe(true);

    const mcpDoc = JSON.parse(readFileSync(join(consumer, "opencode.json"), "utf8")) as {
      mcp?: Record<string, Record<string, unknown>>;
    };
    expect(mcpDoc.mcp?.stdio).toMatchObject({ type: "local", command: expect.any(Array) });
    expect(mcpDoc.mcp?.http).toMatchObject({
      type: "remote",
      url: "https://example.test/mcp",
    });
    // SSE must not be silently remapped into OpenCode local/remote.
    expect(mcpDoc.mcp?.sse).toBeUndefined();
  });
});
