/**
 * OpenCode configureMcp → opencode.json mcp (local/remote); SSE fail-closed.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOpencodeIntegration } from "../../src/index.ts";

type TempDir = { cwd: string; cleanup: () => void };

function createTempDir(prefix = "bapm-oc-mcp-"): TempDir {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

describe("opencode configureMcp → opencode.json", () => {
  let project: TempDir;

  afterEach(() => {
    project?.cleanup();
  });

  test("stdio maps to local command array", async () => {
    project = createTempDir();
    mkdirSync(join(project.cwd, ".opencode"), { recursive: true });
    const target = createOpencodeIntegration();
    const report = await target.configureMcp!(
      [
        {
          name: "test-stdio-server",
          transport: "stdio",
          command: "echo",
          args: ["--greeting", "hello"],
        },
      ],
      { cwd: project.cwd, deployRoots: target.deployRoots, targetId: "opencode" },
    );

    expect(report.configPath).toBe("opencode.json");
    expect(report.targetId).toBe("opencode");
    const doc = JSON.parse(readFileSync(join(project.cwd, "opencode.json"), "utf8")) as {
      mcp?: Record<string, Record<string, unknown>>;
    };
    expect(doc.mcp!["test-stdio-server"]).toEqual({
      type: "local",
      command: ["echo", "--greeting", "hello"],
    });
  });

  test("portable streamable-http maps to remote; sse fails closed", async () => {
    project = createTempDir();
    mkdirSync(join(project.cwd, ".opencode"), { recursive: true });
    const target = createOpencodeIntegration();
    const report = await target.configureMcp!(
      [
        {
          name: "portable-http",
          format: "agent-plugin",
          transport: "streamable-http",
          url: "https://example.test/mcp",
          packageName: "plugin",
        },
        {
          name: "portable-sse",
          format: "agent-plugin",
          transport: "sse",
          url: "https://example.test/sse",
        },
      ],
      { cwd: project.cwd, deployRoots: target.deployRoots, targetId: "opencode" },
    );

    const doc = JSON.parse(readFileSync(join(project.cwd, "opencode.json"), "utf8")) as {
      mcp?: Record<string, Record<string, unknown>>;
    };
    expect(doc.mcp!["portable-http"]).toMatchObject({
      type: "remote",
      url: "https://example.test/mcp",
    });
    expect(doc.mcp!["portable-http"]).not.toHaveProperty("format");
    expect(doc.mcp?.["portable-sse"]).toBeUndefined();
    expect(report.servers).toEqual(["portable-http"]);
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ server: "portable-sse" })]),
    );
  });

  test("preserves unrelated keys and only writes opencode.json", async () => {
    project = createTempDir();
    mkdirSync(join(project.cwd, ".opencode"), { recursive: true });
    writeFileSync(
      join(project.cwd, "opencode.json"),
      `${JSON.stringify({ model: "keep", mcp: { manual: { type: "remote", url: "https://m.test" } } }, null, 2)}\n`,
      "utf8",
    );
    const target = createOpencodeIntegration();
    await target.configureMcp!(
      [{ name: "owned", transport: "stdio", command: "node", args: ["s.mjs"] }],
      { cwd: project.cwd, deployRoots: target.deployRoots, targetId: "opencode" },
    );
    const doc = JSON.parse(readFileSync(join(project.cwd, "opencode.json"), "utf8")) as {
      model?: string;
      mcp?: Record<string, Record<string, unknown>>;
    };
    expect(doc.model).toBe("keep");
    expect(doc.mcp!["manual"]).toEqual({ type: "remote", url: "https://m.test" });
    expect(doc.mcp!["owned"]).toMatchObject({ type: "local" });
    expect(existsSync(join(project.cwd, ".opencode", "mcp.json"))).toBe(false);
  });
});
