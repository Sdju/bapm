/**
 * M9 MUST: bapm-target-cursor writes .cursor/mcp.json under registered roots.
 * Specs: target-cursor-minimal, cursor-mcp-deploy. Checklist D §1, 5.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCursorTarget } from "../../src/index.ts";

type TempDir = { cwd: string; cleanup: () => void };

function createTempDir(prefix = "bapm-m9-cursor-"): TempDir {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

function getConfigureMcp(
  target: Record<string, unknown>,
): (servers: unknown, ctx: { cwd: string; deployRoots?: string[] }) => unknown {
  const fn =
    target.configureMcp ?? target.writeMcpConfig ?? target.deployMcp ?? target.configureMcpServers;
  if (typeof fn !== "function") {
    throw new TypeError(
      "expected createCursorTarget() to expose configureMcp (or writeMcpConfig/deployMcp)",
    );
  }
  return fn.bind(target) as (
    servers: unknown,
    ctx: { cwd: string; deployRoots?: string[] },
  ) => unknown;
}

describe("target-cursor M9 MCP configure → .cursor/mcp.json", () => {
  let project: TempDir;

  afterEach(() => {
    project?.cleanup();
  });

  test("configureMcp writes mcpServers stdio entry under .cursor/mcp.json", async () => {
    project = createTempDir();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });

    const target = createCursorTarget() as unknown as Record<string, unknown>;
    const configureMcp = getConfigureMcp(target);

    const report = (await configureMcp(
      [
        {
          name: "test-stdio-server",
          transport: "stdio",
          type: "stdio",
          command: "echo",
          args: ["--greeting", "hello"],
        },
      ],
      { cwd: project.cwd, deployRoots: (target.deployRoots as string[]) ?? [".cursor"] },
    )) as { configPath?: unknown };

    const path = join(project.cwd, ".cursor", "mcp.json");
    expect(existsSync(path)).toBe(true);
    expect(report.configPath).toBe(".cursor/mcp.json");
    const doc = JSON.parse(readFileSync(path, "utf8")) as {
      mcpServers?: Record<string, Record<string, unknown>>;
    };
    expect(doc.mcpServers).toHaveProperty("test-stdio-server");
    const server = doc.mcpServers!["test-stdio-server"]!;
    expect(server.command === "echo" || server.type === "stdio").toBe(true);
  });

  test("MCP config path never escapes registered .cursor/ root", async () => {
    project = createTempDir();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });

    const target = createCursorTarget() as unknown as Record<string, unknown>;
    const configureMcp = getConfigureMcp(target);

    await configureMcp([{ name: "bounded", transport: "stdio", command: "true" }], {
      cwd: project.cwd,
      deployRoots: [".cursor", ".agents/skills"],
    });

    expect(existsSync(join(project.cwd, ".cursor", "mcp.json"))).toBe(true);
    expect(existsSync(join(project.cwd, "mcp.json"))).toBe(false);
    expect(existsSync(join(project.cwd, ".agents", "mcp.json"))).toBe(false);
  });

  test("adapts portable transports without copying portable metadata", async () => {
    project = createTempDir();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    const target = createCursorTarget() as unknown as Record<string, unknown>;
    const configureMcp = getConfigureMcp(target);

    await configureMcp(
      [
        {
          name: "portable-http",
          format: "agent-plugin",
          transport: "streamable-http",
          url: "https://example.test/mcp",
          packageName: "portable-plugin",
        },
        {
          name: "portable-stdio",
          format: "agent-plugin",
          transport: "stdio",
          command: "node",
          args: ["server.mjs"],
          cwd: "/plugin",
          env: { PLUGIN_ROOT: "/plugin", PLUGIN_DATA: "/data" },
        },
      ],
      { cwd: project.cwd, deployRoots: (target.deployRoots as string[]) ?? [".cursor"] },
    );

    const doc = JSON.parse(readFileSync(join(project.cwd, ".cursor", "mcp.json"), "utf8")) as {
      mcpServers: Record<string, Record<string, unknown>>;
    };
    expect(doc.mcpServers["portable-http"]).toEqual({
      type: "http",
      url: "https://example.test/mcp",
    });
    expect(doc.mcpServers["portable-stdio"]).toEqual({
      type: "stdio",
      command: "node",
      args: ["server.mjs"],
      cwd: "/plugin",
      env: { PLUGIN_ROOT: "/plugin", PLUGIN_DATA: "/data" },
    });
  });

  test("materialize still does not require writing mcp.json for skills/rules", async () => {
    project = createTempDir();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    const src = join(project.cwd, "src-skill", "SKILL.md");
    mkdirSync(join(project.cwd, "src-skill"), { recursive: true });
    writeFileSync(src, "---\nname: hello\n---\n# Hello\n", "utf8");

    const target = createCursorTarget();
    await target.materialize([{ name: "hello", type: "skill", source: "local", path: src }], {
      cwd: project.cwd,
      targetId: "cursor",
      deployRoots: target.deployRoots,
    });

    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(true);
    // Skills-only materialize must not invent mcp.json.
    expect(existsSync(join(project.cwd, ".cursor", "mcp.json"))).toBe(false);
  });
});
