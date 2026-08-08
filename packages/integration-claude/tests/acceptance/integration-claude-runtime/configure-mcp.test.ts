/**
 * configureMcp → project .mcp.json when .claude/ exists; skill launcher rewrite.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClaudeTarget, createTempDir, requireConfigureMcp, type TempDir } from "./helpers.ts";

type ClaudeMcpDoc = {
  mcpServers?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};

describe("integration-claude-runtime · configureMcp", () => {
  let project: TempDir | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("writes mcpServers stdio entry under project .mcp.json when .claude exists", async () => {
    project = createTempDir("bapm-acc-claude-mcp-write-");
    mkdirSync(join(project.cwd, ".claude"), { recursive: true });

    const target = await createClaudeTarget();
    const configureMcp = requireConfigureMcp(target);
    const report = await configureMcp(
      [
        {
          name: "test-stdio-server",
          transport: "stdio",
          type: "stdio",
          command: "echo",
          args: ["--greeting", "hello"],
        },
      ],
      { cwd: project.cwd, deployRoots: target.deployRoots, targetId: "claude" },
    );

    const path = join(project.cwd, ".mcp.json");
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
    project = createTempDir("bapm-acc-claude-mcp-skip-");
    expect(existsSync(join(project.cwd, ".claude"))).toBe(false);

    const target = await createClaudeTarget();
    const configureMcp = requireConfigureMcp(target);
    const report = await configureMcp([{ name: "skipped", transport: "stdio", command: "true" }], {
      cwd: project.cwd,
      deployRoots: target.deployRoots,
      targetId: "claude",
    });

    expect(existsSync(join(project.cwd, ".mcp.json"))).toBe(false);
    expect(existsSync(join(project.cwd, ".claude.json"))).toBe(false);
    expect(report.diagnostics?.length).toBeGreaterThan(0);
    expect(report.servers ?? []).not.toContain("skipped");
  });

  test("rewrites .agents/skills/ launcher prefix to .claude/skills/", async () => {
    project = createTempDir("bapm-acc-claude-mcp-rewrite-");
    mkdirSync(join(project.cwd, ".claude"), { recursive: true });

    const target = await createClaudeTarget();
    const configureMcp = requireConfigureMcp(target);
    await configureMcp(
      [
        {
          name: "skill-launcher",
          transport: "stdio",
          command: ".agents/skills/my-skill/run.sh",
          args: ["--ok"],
        },
      ],
      { cwd: project.cwd, deployRoots: target.deployRoots, targetId: "claude" },
    );

    const doc = JSON.parse(readFileSync(join(project.cwd, ".mcp.json"), "utf8")) as ClaudeMcpDoc;
    const command = String(doc.mcpServers?.["skill-launcher"]?.command ?? "");
    expect(command.startsWith(".claude/skills/")).toBe(true);
    expect(command.startsWith(".agents/skills/")).toBe(false);
  });

  test("preserves unrelated .mcp.json keys and other mcpServers", async () => {
    project = createTempDir("bapm-acc-claude-mcp-merge-");
    mkdirSync(join(project.cwd, ".claude"), { recursive: true });
    writeFileSync(
      join(project.cwd, ".mcp.json"),
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

    const target = await createClaudeTarget();
    const configureMcp = requireConfigureMcp(target);
    await configureMcp(
      [{ name: "owned", transport: "stdio", command: "node", args: ["server.mjs"] }],
      { cwd: project.cwd, deployRoots: target.deployRoots, targetId: "claude" },
    );

    const doc = JSON.parse(readFileSync(join(project.cwd, ".mcp.json"), "utf8")) as ClaudeMcpDoc;
    expect(doc.meta).toBe("keep-me");
    expect(doc.mcpServers!["manual"]).toEqual({ type: "stdio", command: "manual-bin" });
    expect(doc.mcpServers!["owned"]).toMatchObject({ type: "stdio", command: "node" });
  });

  test("MCP writes only project .mcp.json (not user-scope paths)", async () => {
    project = createTempDir("bapm-acc-claude-mcp-contain-");
    mkdirSync(join(project.cwd, ".claude"), { recursive: true });

    const target = await createClaudeTarget();
    const configureMcp = requireConfigureMcp(target);
    await configureMcp([{ name: "bounded", transport: "stdio", command: "true" }], {
      cwd: project.cwd,
      deployRoots: target.deployRoots,
      targetId: "claude",
    });

    expect(existsSync(join(project.cwd, ".mcp.json"))).toBe(true);
    expect(existsSync(join(project.cwd, ".claude", "mcp.json"))).toBe(false);
    expect(existsSync(join(project.cwd, ".cursor", "mcp.json"))).toBe(false);
  });
});
