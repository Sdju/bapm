import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createIntegrationRegistry } from "bapm-integration-api";
import { createCursorIntegration } from "bapm-integration-cursor";
import {
  AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
  AgentPluginsError,
  discoverAgentPluginMcp,
  discoverAgentPluginSkills,
  extractPackArchive,
  loadAgentPluginManifest,
  resolveDependencyGraph,
  runInstall,
  runPack,
  writeAgentPluginManifest,
} from "@bapm/core";

let root: string | undefined;

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

function createPlugin(manifest: Record<string, unknown> = {}): string {
  root = join(tmpdir(), `bapm-agent-plugin-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "plugin.json"),
    JSON.stringify({
      $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
      name: "portable-plugin",
      ...manifest,
    }),
    "utf8",
  );
  return root;
}

function writeSkill(path: string): void {
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, "SKILL.md"), "---\nname: example\n---\n# Example\n", "utf8");
}

describe("Agent Plugins v1 consumer foundation", () => {
  test("loads a valid root manifest and warns for ignored unknown fields", () => {
    const plugin = createPlugin({ futureField: true });

    const loaded = loadAgentPluginManifest({ root: plugin });

    expect(loaded.manifest.name).toBe("portable-plugin");
    expect(loaded.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "AGENT_PLUGIN_UNKNOWN_FIELD", severity: "warning" }),
      ]),
    );
  });

  test("rejects structural manifest violations before component discovery", () => {
    const plugin = createPlugin({ name: "Invalid Name" });
    writeSkill(join(plugin, "skills", "would-not-load"));

    expect(() => discoverAgentPluginSkills({ root: plugin })).toThrow(AgentPluginsError);
    expect(() => discoverAgentPluginSkills({ root: plugin })).toThrow(
      /valid Agent Plugins v1 name/,
    );
  });

  test("discovers only immediate skill directories", () => {
    const plugin = createPlugin();
    writeSkill(join(plugin, "skills", "direct"));
    writeSkill(join(plugin, "skills", "nested", "deeper"));

    const result = discoverAgentPluginSkills({ root: plugin });

    expect(result.skills.map((skill) => skill.name)).toEqual(["direct"]);
  });

  test("skips broken and escaping individual skills while retaining safe skills", () => {
    const plugin = createPlugin();
    writeSkill(join(plugin, "skills", "safe"));
    symlinkSync(join(plugin, "missing"), join(plugin, "skills", "broken"));

    const outside = join(tmpdir(), `bapm-agent-plugin-outside-${Date.now()}`);
    writeSkill(outside);
    symlinkSync(outside, join(plugin, "skills", "escape"));

    const result = discoverAgentPluginSkills({ root: plugin });

    expect(result.skills.map((skill) => skill.name)).toEqual(["safe"]);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "AGENT_PLUGIN_SKILL_INVALID" })]),
    );
    rmSync(outside, { recursive: true, force: true });
  });

  test("parses portable MCP transports and isolates malformed servers", () => {
    const plugin = createPlugin();
    writeFileSync(
      join(plugin, "mcp.json"),
      JSON.stringify({
        mcpServers: {
          stdio: { type: "stdio", command: "node", args: ["${PLUGIN_ROOT}/bin/server"], cwd: "." },
          http: { type: "streamable-http", url: "https://example.test/mcp" },
          sse: { type: "sse", url: "https://example.test/sse" },
          broken: { type: "stdio", command: 42 },
        },
      }),
    );

    const result = discoverAgentPluginMcp({ root: plugin, dataRoot: join(plugin, ".data") });

    expect(result.servers.map((server) => server.name)).toEqual(["stdio", "http", "sse"]);
    expect(result.servers[0]?.env?.PLUGIN_ROOT).toBe(plugin);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "AGENT_PLUGIN_MCP_SERVER_INVALID" }),
      ]),
    );
  });

  test("rejects portable MCP reserved env and cwd escapes without breaking skills", () => {
    const plugin = createPlugin();
    writeSkill(join(plugin, "skills", "safe"));
    writeFileSync(
      join(plugin, "mcp.json"),
      JSON.stringify({
        mcpServers: {
          override: { type: "stdio", command: "x", env: { PLUGIN_DATA: "/tmp/no" } },
          escape: { type: "stdio", command: "x", cwd: "../outside" },
        },
      }),
    );

    const mcp = discoverAgentPluginMcp({ root: plugin, dataRoot: join(plugin, ".data") });

    expect(mcp.servers).toEqual([]);
    expect(discoverAgentPluginSkills({ root: plugin }).skills).toHaveLength(1);
    expect(mcp.diagnostics.map((d) => d.code)).toEqual(
      expect.arrayContaining(["AGENT_PLUGIN_MCP_ENV_RESERVED", "AGENT_PLUGIN_MCP_PATH_ESCAPE"]),
    );
  });

  test("resolves a standalone portable local root without apm.yml", async () => {
    const project = join(tmpdir(), `bapm-agent-plugin-project-${Date.now()}`);
    const plugin = join(project, "plugins", "portable");
    mkdirSync(project, { recursive: true });
    mkdirSync(plugin, { recursive: true });
    writeFileSync(
      join(plugin, "plugin.json"),
      JSON.stringify({
        $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
        name: "portable-plugin",
      }),
    );
    writeFileSync(
      join(project, "apm.yml"),
      "name: project\nversion: 1.0.0\ndependencies:\n  apm:\n    - path: ./plugins/portable\n",
    );

    const result = await resolveDependencyGraph({ cwd: project, skipDownload: true });

    expect(result.nodes[0]).toMatchObject({
      name: "portable-plugin",
      kind: "local",
      artifactFormat: "agent-plugin",
    });
    rmSync(project, { recursive: true, force: true });
  });

  test("producer root round-trips through portable pack, safe extract, and discovery", async () => {
    const plugin = createPlugin();
    writeAgentPluginManifest({
      root: plugin,
      name: "round-trip-plugin",
      version: "1.2.3",
      description: "Portable plugin",
    });
    writeSkill(join(plugin, "skills", "example"));
    writeFileSync(join(plugin, "skills", "example", "guide.md"), "auxiliary skill file\n");
    writeFileSync(
      join(plugin, "mcp.json"),
      JSON.stringify({ mcpServers: { example: { type: "stdio", command: "node" } } }),
    );

    const packed = await runPack({ cwd: plugin, archive: true, agentPlugins: true });
    const extracted = join(tmpdir(), `bapm-agent-plugin-extract-${Date.now()}`);
    try {
      await extractPackArchive({ archivePath: packed.archivePath, outputDir: extracted });
      expect(readFileSync(join(extracted, "skills", "example", "guide.md"), "utf8")).toBe(
        "auxiliary skill file\n",
      );
      expect(
        discoverAgentPluginSkills({ root: extracted }).skills.map((skill) => skill.name),
      ).toEqual(["example"]);
      expect(
        discoverAgentPluginMcp({ root: extracted, dataRoot: join(extracted, ".data") }).servers,
      ).toHaveLength(1);
    } finally {
      rmSync(extracted, { recursive: true, force: true });
    }
  });

  test("producer pack → extract → install maps portable skills and MCP to Cursor", async () => {
    const project = join(tmpdir(), `bapm-agent-plugin-e2e-${Date.now()}`);
    const producer = join(project, "producer");
    const consumer = join(project, "consumer");
    const plugin = join(consumer, "plugin");
    mkdirSync(producer, { recursive: true });
    writeAgentPluginManifest({ root: producer, name: "e2e-plugin", version: "1.0.0" });
    writeSkill(join(producer, "skills", "e2e-skill"));
    writeFileSync(join(producer, "skills", "e2e-skill", "references.md"), "# Reference\n", "utf8");
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

    try {
      const packed = await runPack({ cwd: producer, archive: true, agentPlugins: true });
      await extractPackArchive({ archivePath: packed.archivePath, outputDir: plugin });
      mkdirSync(join(consumer, ".cursor"), { recursive: true });
      writeFileSync(
        join(consumer, "bapm.yml"),
        "name: consumer\nversion: 1.0.0\ntarget: cursor\ndependencies:\n  apm:\n    - path: ./plugin\n",
        "utf8",
      );
      const registry = createIntegrationRegistry();
      registry.register(createCursorIntegration());

      await runInstall({ cwd: consumer, integrationRegistry: registry, registry });

      expect(
        readFileSync(join(consumer, ".agents", "skills", "e2e-skill", "references.md"), "utf8"),
      ).toBe("# Reference\n");
      const mcp = JSON.parse(readFileSync(join(consumer, ".cursor", "mcp.json"), "utf8")) as {
        mcpServers: Record<string, Record<string, unknown>>;
      };
      expect(mcp.mcpServers.stdio).toMatchObject({ type: "stdio", command: "node" });
      expect(mcp.mcpServers.http).toMatchObject({ type: "http", url: "https://example.test/mcp" });
      expect(mcp.mcpServers.sse).toMatchObject({ type: "sse", url: "https://example.test/sse" });
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  test("producer rejects invalid names and portable pack rejects invalid schema", async () => {
    expect(() =>
      writeAgentPluginManifest({
        root: join(tmpdir(), `bapm-invalid-agent-plugin-${Date.now()}`),
        name: "Invalid Name",
      }),
    ).toThrow(/valid Agent Plugins v1 name/);

    const plugin = createPlugin({ $schema: "https://example.test/not-agent-plugins.json" });
    await expect(runPack({ cwd: plugin, archive: true, agentPlugins: true })).rejects.toThrow(
      /\$schema|Agent Plugin manifest/,
    );
    expect(existsSync(join(plugin, "portable-plugin-0.0.0.zip"))).toBe(false);
  });
});
