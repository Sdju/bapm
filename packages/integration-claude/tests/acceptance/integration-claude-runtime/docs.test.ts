/**
 * Docs expect Claude as opt-in runtime host (plus marketplace pack), not marketplace-only.
 */
import { describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./helpers.ts";

const docsRoot = join(REPO_ROOT, "apps/docs");
const supportedHostsPath = join(docsRoot, "guide/supported-hosts.md");
const architecturePath = join(docsRoot, "architecture/index.md");
const marketplacePackPath = join(docsRoot, "guide/situations/marketplace-pack.md");

describe("integration-claude-runtime · docs", () => {
  test("supported-hosts documents Claude as opt-in runtime + marketplace", () => {
    expect(existsSync(supportedHostsPath)).toBe(true);
    const page = readFileSync(supportedHostsPath, "utf8");
    expect(page).toMatch(/@bapm\/integration-claude/);
    expect(page).toMatch(/targets:/);
    expect(page).toMatch(/\.claude\/skills|CLAUDE\.md|\.mcp\.json/);
    // Table must not brand Claude as non-runtime forever.
    expect(page).not.toMatch(/\|\s*\*\*Claude\s*\/\s*Codex\*\*\s*\|\s*Нет\s*\(не runtime\)/i);
    // Section should treat Claude like other opt-in runtime hosts.
    expect(page).toMatch(/Claude[\s\S]{0,400}opt-in|targets:[\s\S]{0,200}claude/i);
  });

  test("architecture index lists Claude runtime (not marketplace-only)", () => {
    expect(existsSync(architecturePath)).toBe(true);
    const arch = readFileSync(architecturePath, "utf8");
    expect(arch).toMatch(/@bapm\/integration-claude/);
    expect(arch).toMatch(/integration-claude[^\n]*Claude runtime/i);
    expect(arch).not.toMatch(/Claude и Codex — marketplace-output[^\n]*не runtime/i);
  });

  test("marketplace-pack situation allows Claude runtime install", () => {
    expect(existsSync(marketplacePackPath)).toBe(true);
    const page = readFileSync(marketplacePackPath, "utf8");
    expect(page).not.toMatch(/не\*\*\s*shipped как runtime/i);
    expect(page).not.toMatch(/не shipped как runtime/i);
  });
});
