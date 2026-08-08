/**
 * Docs + compatibility matrix: OpenCode as explicit opt-in adapter
 * (promoted from integration-opencode-runtime acceptance).
 */
import { describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import { docsArchitecturePath, docsRoot, fileExists, readText, repoRoot } from "./helpers.ts";

const supportedHostsPath = join(docsRoot, "guide/supported-hosts.md");
const agentPluginsGuideCandidates = [
  join(docsRoot, "guide/agent-plugins.md"),
  join(docsRoot, "reference/agent-plugins.md"),
  join(docsRoot, "guide/agent-plugins/index.md"),
];
const compatibilityCasesPath = join(repoRoot, "tests/agent-plugins/compatibility-cases.json");

describe("docs · OpenCode runtime opt-in", () => {
  test("supported-hosts documents @bapm/integration-opencode opt-in", () => {
    expect(fileExists(supportedHostsPath)).toBe(true);
    const page = readText(supportedHostsPath);
    expect(page).toMatch(/@bapm\/integration-opencode/);
    expect(page).toMatch(/opencode/i);
    expect(page).toMatch(/targets:/);
  });

  test("architecture or agent-plugins docs mention OpenCode adapter", () => {
    const arch = readText(docsArchitecturePath);
    const guide = agentPluginsGuideCandidates
      .filter((p) => fileExists(p))
      .map((p) => readText(p))
      .join("\n");
    const combined = `${arch}\n${guide}`;
    expect(combined).toMatch(/@bapm\/integration-opencode|OpenCode/i);
    expect(combined).toMatch(/opencode\.json|\.opencode\/skills/i);
  });

  test("compatibility-cases.json includes an OpenCode target-specific MCP case", () => {
    expect(fileExists(compatibilityCasesPath)).toBe(true);
    const doc = JSON.parse(readText(compatibilityCasesPath)) as {
      components?: Array<{ id?: string; status?: string; summary?: string; test?: string }>;
    };
    const opencode = (doc.components ?? []).find(
      (c) => c.id === "opencode-mcp" || /opencode/i.test(String(c.id ?? "")),
    );
    expect(opencode).toBeTruthy();
    expect(opencode?.status).toBe("target-specific");
    expect(String(opencode?.summary ?? "")).toMatch(/remote|local|opencode\.json/i);
    expect(String(opencode?.test ?? "")).toMatch(/opencode|agent-plugins/i);
  });
});
