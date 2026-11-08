import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClaudeIntegration } from "../../src/createClaudeIntegration.ts";

type ClaudeLspDoc = {
  name?: string;
  lspServers?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};

const PLUGIN_REL = join(".claude", "skills", "apm-lsp", ".claude-plugin", "plugin.json");

function server(overrides: Record<string, unknown> = {}) {
  return {
    name: "gopls",
    command: "gopls",
    args: ["serve"],
    extensionToLanguage: { ".go": "go" },
    ...overrides,
  };
}

describe("claude configureLsp → apm-lsp plugin manifest", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("writes native lspServers with extensionToLanguage and apm-lsp owner", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-lsp-"));
    mkdirSync(join(cwd, ".claude"), { recursive: true });

    const target = createClaudeIntegration();
    const report = await target.configureLsp!([server()], {
      cwd,
      deployRoots: target.deployRoots,
      targetId: "claude",
    });

    const path = join(cwd, PLUGIN_REL);
    expect(existsSync(path)).toBe(true);
    expect(report.configPath).toBe(".claude/skills/apm-lsp/.claude-plugin/plugin.json");
    const doc = JSON.parse(readFileSync(path, "utf8")) as ClaudeLspDoc;
    expect(doc.name).toBe("apm-lsp");
    expect(doc.lspServers?.gopls).toEqual({
      command: "gopls",
      args: ["serve"],
      extensionToLanguage: { ".go": "go" },
    });
    expect(existsSync(join(cwd, ".lsp.json"))).toBe(false);
  });

  test("preserves foreign servers/keys, prunes managed stale entries, and is idempotent", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-lsp-merge-"));
    const path = join(cwd, PLUGIN_REL);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(
      path,
      `${JSON.stringify(
        {
          name: "apm-lsp",
          custom: "keep-me",
          lspServers: {
            manual: { command: "manual-ls", extensionToLanguage: { ".x": "x" } },
            old: { command: "old-ls", extensionToLanguage: { ".y": "y" } },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const target = createClaudeIntegration();
    await target.configureLsp!([server()], {
      cwd,
      deployRoots: target.deployRoots,
      targetId: "claude",
      managedServers: ["old"],
    });
    const first = readFileSync(path, "utf8");
    const doc = JSON.parse(first) as ClaudeLspDoc;
    expect(doc.custom).toBe("keep-me");
    expect(doc.lspServers?.manual).toEqual({
      command: "manual-ls",
      extensionToLanguage: { ".x": "x" },
    });
    expect(doc.lspServers).not.toHaveProperty("old");
    expect(doc.lspServers).toHaveProperty("gopls");

    await target.configureLsp!([server()], {
      cwd,
      deployRoots: target.deployRoots,
      targetId: "claude",
      managedServers: ["old"],
    });
    expect(readFileSync(path, "utf8")).toBe(first);
  });

  test("rejects a plugin manifest owned by another plugin", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-lsp-owner-"));
    const path = join(cwd, PLUGIN_REL);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, `${JSON.stringify({ name: "other-plugin", lspServers: {} })}\n`, "utf8");

    const target = createClaudeIntegration();
    await expect(
      target.configureLsp!([server()], {
        cwd,
        deployRoots: target.deployRoots,
        targetId: "claude",
      }),
    ).rejects.toThrow(/CLAUDE_LSP_OWNERSHIP/);
  });

  test("rejects a same-name foreign server whose config bapm does not manage", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-lsp-collision-"));
    const path = join(cwd, PLUGIN_REL);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(
      path,
      `${JSON.stringify({
        name: "apm-lsp",
        lspServers: { gopls: { command: "other-gopls", extensionToLanguage: { ".go": "go" } } },
      })}\n`,
      "utf8",
    );

    const target = createClaudeIntegration();
    await expect(
      target.configureLsp!([server()], {
        cwd,
        deployRoots: target.deployRoots,
        targetId: "claude",
      }),
    ).rejects.toThrow(/CLAUDE_LSP_OWNERSHIP/);
  });

  test("removing the last owned server deletes the plugin file", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-lsp-clean-"));
    mkdirSync(join(cwd, ".claude"), { recursive: true });
    const target = createClaudeIntegration();
    await target.configureLsp!([server()], {
      cwd,
      deployRoots: target.deployRoots,
      targetId: "claude",
    });
    const path = join(cwd, PLUGIN_REL);
    expect(existsSync(path)).toBe(true);

    await target.configureLsp!([], {
      cwd,
      deployRoots: target.deployRoots,
      targetId: "claude",
      managedServers: ["gopls"],
    });
    expect(existsSync(path)).toBe(false);
  });
});
