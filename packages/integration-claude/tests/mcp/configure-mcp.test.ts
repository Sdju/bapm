/**
 * configureMcp → project .mcp.json when .claude/ exists; skill launcher rewrite
 * (promoted from integration-claude-runtime acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClaudeIntegration } from "../../src/createClaudeIntegration.ts";

type ClaudeMcpDoc = {
  mcpServers?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};

describe("claude configureMcp → .mcp.json", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("writes mcpServers stdio entry under project .mcp.json when .claude exists", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-mcp-write-"));
    mkdirSync(join(cwd, ".claude"), { recursive: true });

    const target = createClaudeIntegration();
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
      { cwd, deployRoots: target.deployRoots, targetId: "claude" },
    );

    const path = join(cwd, ".mcp.json");
    expect(existsSync(path)).toBe(true);
    expect(report.configPath).toBe(".mcp.json");
    const doc = JSON.parse(readFileSync(path, "utf8")) as ClaudeMcpDoc;
    expect(doc.mcpServers).toHaveProperty("test-stdio-server");
    const server = doc.mcpServers!["test-stdio-server"]!;
    expect(server.type).toBe("stdio");
    expect(server.command).toBe("echo");
    expect(server).not.toHaveProperty("format");
    expect(server).not.toHaveProperty("packageName");
  });

  test("skips project MCP write when .claude/ is absent", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-mcp-skip-"));
    expect(existsSync(join(cwd, ".claude"))).toBe(false);

    const target = createClaudeIntegration();
    const report = await target.configureMcp!(
      [{ name: "skipped", transport: "stdio", command: "true" }],
      {
        cwd,
        deployRoots: target.deployRoots,
        targetId: "claude",
      },
    );

    expect(existsSync(join(cwd, ".mcp.json"))).toBe(false);
    expect(existsSync(join(cwd, ".claude.json"))).toBe(false);
    expect(report.diagnostics?.length).toBeGreaterThan(0);
    expect(report.servers ?? []).not.toContain("skipped");
  });

  test("rewrites .agents/skills/ launcher prefix to .claude/skills/", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-mcp-rewrite-"));
    mkdirSync(join(cwd, ".claude"), { recursive: true });

    const target = createClaudeIntegration();
    await target.configureMcp!(
      [
        {
          name: "skill-launcher",
          transport: "stdio",
          command: ".agents/skills/my-skill/run.sh",
          args: ["--ok"],
        },
      ],
      { cwd, deployRoots: target.deployRoots, targetId: "claude" },
    );

    const doc = JSON.parse(readFileSync(join(cwd, ".mcp.json"), "utf8")) as ClaudeMcpDoc;
    const command = String(doc.mcpServers?.["skill-launcher"]?.command ?? "");
    expect(command.startsWith(".claude/skills/")).toBe(true);
    expect(command.startsWith(".agents/skills/")).toBe(false);
  });

  test("preserves unrelated .mcp.json keys and other mcpServers", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-mcp-merge-"));
    mkdirSync(join(cwd, ".claude"), { recursive: true });
    writeFileSync(
      join(cwd, ".mcp.json"),
      `${JSON.stringify(
        {
          meta: "keep-me",
          mcpServers: {
            manual: { type: "stdio", command: "manual-bin" },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const target = createClaudeIntegration();
    await target.configureMcp!(
      [{ name: "owned", transport: "stdio", command: "node", args: ["server.mjs"] }],
      { cwd, deployRoots: target.deployRoots, targetId: "claude" },
    );

    const doc = JSON.parse(readFileSync(join(cwd, ".mcp.json"), "utf8")) as ClaudeMcpDoc;
    expect(doc.meta).toBe("keep-me");
    expect(doc.mcpServers!["manual"]).toEqual({ type: "stdio", command: "manual-bin" });
    expect(doc.mcpServers!["owned"]).toMatchObject({ type: "stdio", command: "node" });
  });

  test("MCP writes only project .mcp.json (not user-scope paths)", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-mcp-contain-"));
    mkdirSync(join(cwd, ".claude"), { recursive: true });

    const target = createClaudeIntegration();
    await target.configureMcp!([{ name: "bounded", transport: "stdio", command: "true" }], {
      cwd,
      deployRoots: target.deployRoots,
      targetId: "claude",
    });

    expect(existsSync(join(cwd, ".mcp.json"))).toBe(true);
    expect(existsSync(join(cwd, ".claude", "mcp.json"))).toBe(false);
    expect(existsSync(join(cwd, ".cursor", "mcp.json"))).toBe(false);
  });
});
