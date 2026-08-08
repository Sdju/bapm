/**
 * configureMcp → project opencode.json mcp (local/remote); SSE fail-closed; merge-safe.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createOpencodeTarget,
  createTempDir,
  requireConfigureMcp,
  type TempDir,
} from "./helpers.ts";

type OpencodeMcpDoc = {
  mcp?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};

describe("integration-opencode-runtime · configureMcp", () => {
  let project: TempDir | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("stdio maps to type local with command array under mcp", async () => {
    project = createTempDir("bapm-acc-oc-mcp-local-");
    mkdirSync(join(project.cwd, ".opencode"), { recursive: true });

    const target = await createOpencodeTarget();
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
      { cwd: project.cwd, deployRoots: target.deployRoots, targetId: "opencode" },
    );

    const path = join(project.cwd, "opencode.json");
    expect(existsSync(path)).toBe(true);
    expect(report.configPath).toBe("opencode.json");
    const doc = JSON.parse(readFileSync(path, "utf8")) as OpencodeMcpDoc;
    expect(doc.mcp).toHaveProperty("test-stdio-server");
    const server = doc.mcp!["test-stdio-server"]!;
    expect(server.type).toBe("local");
    expect(server.command).toEqual(["echo", "--greeting", "hello"]);
    expect(server).not.toHaveProperty("format");
    expect(server).not.toHaveProperty("packageName");
  });

  test("portable streamable-http maps to type remote with url", async () => {
    project = createTempDir("bapm-acc-oc-mcp-remote-");
    mkdirSync(join(project.cwd, ".opencode"), { recursive: true });

    const target = await createOpencodeTarget();
    const configureMcp = requireConfigureMcp(target);
    await configureMcp(
      [
        {
          name: "portable-http",
          format: "agent-plugin",
          transport: "streamable-http",
          url: "https://example.test/mcp",
          packageName: "portable-plugin",
          headers: { Authorization: "Bearer x" },
        },
      ],
      { cwd: project.cwd, deployRoots: target.deployRoots, targetId: "opencode" },
    );

    const doc = JSON.parse(readFileSync(join(project.cwd, "opencode.json"), "utf8")) as OpencodeMcpDoc;
    expect(doc.mcp!["portable-http"]).toMatchObject({
      type: "remote",
      url: "https://example.test/mcp",
    });
    expect(doc.mcp!["portable-http"]).not.toHaveProperty("format");
    expect(doc.mcp!["portable-http"]).not.toHaveProperty("transport");
    expect(doc.mcp!["portable-http"]).not.toHaveProperty("packageName");
  });

  test("portable sse fails closed without inventing local/remote entry", async () => {
    project = createTempDir("bapm-acc-oc-mcp-sse-");
    mkdirSync(join(project.cwd, ".opencode"), { recursive: true });

    const target = await createOpencodeTarget();
    const configureMcp = requireConfigureMcp(target);

    let threw = false;
    let report: Awaited<ReturnType<typeof configureMcp>> | undefined;
    try {
      report = await configureMcp(
        [
          {
            name: "portable-sse",
            format: "agent-plugin",
            transport: "sse",
            url: "https://example.test/sse",
          },
        ],
        { cwd: project.cwd, deployRoots: target.deployRoots, targetId: "opencode" },
      );
    } catch {
      threw = true;
    }

    const path = join(project.cwd, "opencode.json");
    if (existsSync(path)) {
      const doc = JSON.parse(readFileSync(path, "utf8")) as OpencodeMcpDoc;
      expect(doc.mcp?.["portable-sse"]).toBeUndefined();
    }

    if (!threw) {
      expect(report?.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            server: "portable-sse",
          }),
        ]),
      );
      expect(report?.servers ?? []).not.toContain("portable-sse");
    }
  });

  test("preserves unrelated opencode.json keys and other mcp servers", async () => {
    project = createTempDir("bapm-acc-oc-mcp-merge-");
    mkdirSync(join(project.cwd, ".opencode"), { recursive: true });
    writeFileSync(
      join(project.cwd, "opencode.json"),
      `${JSON.stringify(
        {
          model: "keep-me",
          mcp: {
            manual: { type: "remote", url: "https://manual.test/mcp" },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const target = await createOpencodeTarget();
    const configureMcp = requireConfigureMcp(target);
    await configureMcp(
      [{ name: "owned", transport: "stdio", command: "node", args: ["server.mjs"] }],
      { cwd: project.cwd, deployRoots: target.deployRoots, targetId: "opencode" },
    );

    const doc = JSON.parse(readFileSync(join(project.cwd, "opencode.json"), "utf8")) as OpencodeMcpDoc;
    expect(doc.model).toBe("keep-me");
    expect(doc.mcp!["manual"]).toEqual({ type: "remote", url: "https://manual.test/mcp" });
    expect(doc.mcp!["owned"]).toMatchObject({ type: "local" });
  });

  test("MCP writes only opencode.json at project root (not arbitrary paths)", async () => {
    project = createTempDir("bapm-acc-oc-mcp-contain-");
    mkdirSync(join(project.cwd, ".opencode"), { recursive: true });

    const target = await createOpencodeTarget();
    const configureMcp = requireConfigureMcp(target);
    await configureMcp([{ name: "bounded", transport: "stdio", command: "true" }], {
      cwd: project.cwd,
      deployRoots: target.deployRoots,
      targetId: "opencode",
    });

    expect(existsSync(join(project.cwd, "opencode.json"))).toBe(true);
    expect(existsSync(join(project.cwd, ".opencode", "mcp.json"))).toBe(false);
    expect(existsSync(join(project.cwd, ".cursor", "mcp.json"))).toBe(false);
  });
});
