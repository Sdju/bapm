import { cpSync, existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";
import {
  discoverAgentPluginMcp,
  discoverAgentPluginSkills,
  loadAgentPluginManifest,
} from "@b-apm/core";

type CompatibilityCase = {
  id: string;
  status: string;
  fixture: string;
  test: string;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const cases = JSON.parse(
  await import("node:fs").then(({ readFileSync }) =>
    readFileSync(join(repoRoot, "tests/agent-plugins/compatibility-cases.json"), "utf8"),
  ),
) as { components: CompatibilityCase[] };

describe("Agent Plugins v1 compatibility status fixtures", () => {
  test("every published status row cites a checked-in fixture and regression test", () => {
    expect(cases.components.length).toBeGreaterThan(0);
    for (const component of cases.components) {
      expect(existsSync(join(repoRoot, component.fixture)), `${component.id} fixture`).toBe(true);
      expect(existsSync(join(repoRoot, component.test)), `${component.id} test`).toBe(true);
    }
  });

  test("portable fixture validates manifest, skills, and MCP transports", () => {
    const root = join(repoRoot, "tests/fixtures/agent-plugins/v1-portable");

    expect(loadAgentPluginManifest({ root }).manifest.name).toBe("portable-fixture");
    expect(discoverAgentPluginSkills({ root }).skills.map((skill) => skill.name)).toEqual([
      "fixture-skill",
    ]);
    expect(
      discoverAgentPluginMcp({
        root,
        dataRoot: join(tmpdir(), "bapm-agent-plugin-fixture-data"),
      }).servers.map((server) => server.transport),
    ).toEqual(["stdio", "streamable-http", "sse"]);
  });

  test("unsafe fixture rejects reserved, secret-like, and escaping MCP configuration", () => {
    const root = join(repoRoot, "tests/fixtures/agent-plugins/v1-unsafe");
    const result = discoverAgentPluginMcp({
      root,
      dataRoot: join(tmpdir(), "bapm-agent-plugin-data"),
    });

    expect(result.servers).toEqual([]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "AGENT_PLUGIN_MCP_ENV_RESERVED",
        "AGENT_PLUGIN_MCP_SECRET_REFUSED",
        "AGENT_PLUGIN_MCP_PATH_ESCAPE",
      ]),
    );
  });

  test("escaping skill symlink is rejected without dropping valid fixture skill", () => {
    const source = join(repoRoot, "tests/fixtures/agent-plugins/v1-portable");
    const temp = mkdtempSync(join(tmpdir(), "bapm-agent-plugin-status-"));
    try {
      const linked = join(temp, "plugin");
      cpSync(source, linked, { recursive: true });
      symlinkSync(tmpdir(), join(linked, "skills", "escape"));

      const result = discoverAgentPluginSkills({ root: linked });
      expect(result.skills.map((skill) => skill.name)).toEqual(["fixture-skill"]);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "AGENT_PLUGIN_SKILL_INVALID" })]),
      );
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
});
