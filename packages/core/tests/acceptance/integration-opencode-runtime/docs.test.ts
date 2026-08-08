/**
 * Docs + compatibility matrix expect OpenCode as an explicit opt-in adapter.
 */
import { describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./helpers.ts";

const docsRoot = join(REPO_ROOT, "apps/docs");
const supportedHostsPath = join(docsRoot, "guide/supported-hosts.md");
const agentPluginsGuideCandidates = [
  join(docsRoot, "guide/agent-plugins.md"),
  join(docsRoot, "reference/agent-plugins.md"),
  join(docsRoot, "guide/agent-plugins/index.md"),
];
const architecturePath = join(docsRoot, "architecture/index.md");
const compatibilityCasesPath = join(REPO_ROOT, "tests/agent-plugins/compatibility-cases.json");

describe("integration-opencode-runtime · docs and compatibility", () => {
  test("supported-hosts documents @bapm/integration-opencode opt-in", () => {
    expect(existsSync(supportedHostsPath)).toBe(true);
    const page = readFileSync(supportedHostsPath, "utf8");
    expect(page).toMatch(/@bapm\/integration-opencode/);
    expect(page).toMatch(/opencode/i);
    expect(page).toMatch(/targets:/);
  });

  test("architecture or agent-plugins docs mention OpenCode adapter", () => {
    const arch = readFileSync(architecturePath, "utf8");
    const guide = agentPluginsGuideCandidates
      .filter((p) => existsSync(p))
      .map((p) => readFileSync(p, "utf8"))
      .join("\n");
    const combined = `${arch}\n${guide}`;
    expect(combined).toMatch(/@bapm\/integration-opencode|OpenCode/i);
    expect(combined).toMatch(/opencode\.json|\.opencode\/skills/i);
  });

  test("compatibility-cases.json includes an OpenCode target-specific MCP case", () => {
    expect(existsSync(compatibilityCasesPath)).toBe(true);
    const doc = JSON.parse(readFileSync(compatibilityCasesPath, "utf8")) as {
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
