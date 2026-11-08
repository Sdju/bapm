/**
 * configureMcp → `.codex/config.toml` `mcp_servers` (TOML);
 * SSE reject; malformed skip; preserve unrelated; mkdir-on-write; no user-scope
 * (promoted from integration-codex-runtime acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import { createCodexIntegration } from "../../src/createCodexIntegration.ts";

describe("codex configureMcp → .codex/config.toml mcp_servers", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("writes mcp_servers stdio entry under .codex/config.toml", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-mcp-write-"));
    mkdirSync(join(cwd, ".codex"), { recursive: true });

    const target = createCodexIntegration();
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
      { cwd, deployRoots: target.deployRoots, targetId: "codex" },
    );

    const path = join(cwd, ".codex", "config.toml");
    expect(existsSync(path)).toBe(true);
    expect(report.configPath).toMatch(/\.codex\/config\.toml$/);
    const raw = readFileSync(path, "utf8");
    expect(raw).toMatch(/mcp_servers/);
    expect(raw).toMatch(/test-stdio-server/);
    expect(raw).toMatch(/echo/);
    expect(report.servers ?? []).toContain("test-stdio-server");
    expect(existsSync(join(cwd, ".mcp.json"))).toBe(false);
    expect(existsSync(join(cwd, ".cursor", "mcp.json"))).toBe(false);
  });

  test("https streamable-http remote is written", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-mcp-https-"));
    mkdirSync(join(cwd, ".codex"), { recursive: true });

    const target = createCodexIntegration();
    await target.configureMcp!(
      [
        {
          name: "remote-http",
          transport: "streamable-http",
          type: "streamable-http",
          url: "https://example.test/mcp",
        },
      ],
      { cwd, deployRoots: target.deployRoots, targetId: "codex" },
    );

    const raw = readFileSync(join(cwd, ".codex", "config.toml"), "utf8");
    expect(raw).toMatch(/remote-http/);
    expect(raw).toMatch(/https:\/\/example\.test\/mcp/);
  });

  test("SSE remote is rejected with diagnostic and not written", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-mcp-sse-"));
    mkdirSync(join(cwd, ".codex"), { recursive: true });

    const target = createCodexIntegration();
    const report = await target.configureMcp!(
      [
        {
          name: "portable-sse",
          transport: "sse",
          type: "sse",
          url: "https://example.test/sse",
        },
      ],
      { cwd, deployRoots: target.deployRoots, targetId: "codex" },
    );

    const path = join(cwd, ".codex", "config.toml");
    if (existsSync(path)) {
      const raw = readFileSync(path, "utf8");
      expect(raw).not.toMatch(/portable-sse/);
    }
    expect(report.servers ?? []).not.toContain("portable-sse");
    expect(report.diagnostics?.length).toBeGreaterThan(0);
    expect(
      report.diagnostics?.some(
        (d: { server?: string; message: string; code?: string }) =>
          d.server === "portable-sse" || /sse/i.test(d.message) || /sse/i.test(d.code ?? ""),
      ),
    ).toBe(true);
  });

  test("malformed TOML is not clobbered", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-mcp-malformed-"));
    mkdirSync(join(cwd, ".codex"), { recursive: true });
    const path = join(cwd, ".codex", "config.toml");
    const broken = "this is [[[ not valid toml = {{\n";
    writeFileSync(path, broken, "utf8");

    const target = createCodexIntegration();
    const report = await target.configureMcp!(
      [{ name: "should-skip", transport: "stdio", command: "true" }],
      { cwd, deployRoots: target.deployRoots, targetId: "codex" },
    );

    expect(readFileSync(path, "utf8")).toBe(broken);
    expect(report.servers ?? []).not.toContain("should-skip");
    expect(report.diagnostics?.length).toBeGreaterThan(0);
  });

  test("existing unrelated mcp_servers and top-level tables are preserved", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-mcp-merge-"));
    mkdirSync(join(cwd, ".codex"), { recursive: true });
    writeFileSync(
      join(cwd, ".codex", "config.toml"),
      ['model = "keep-me"', "", "[mcp_servers.manual]", 'command = "manual-bin"', ""].join("\n"),
      "utf8",
    );

    const target = createCodexIntegration();
    await target.configureMcp!(
      [{ name: "owned", transport: "stdio", command: "node", args: ["server.mjs"] }],
      { cwd, deployRoots: target.deployRoots, targetId: "codex" },
    );

    const raw = readFileSync(join(cwd, ".codex", "config.toml"), "utf8");
    expect(raw).toMatch(/model\s*=\s*"keep-me"/);
    expect(raw).toMatch(/mcp_servers\.manual|\[mcp_servers\.manual\]/);
    expect(raw).toMatch(/manual-bin/);
    expect(raw).toMatch(/owned/);
    expect(raw).toMatch(/node/);
  });

  test("forced configureMcp creates .codex/ for MCP when absent", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-mcp-force-mkdir-"));
    expect(existsSync(join(cwd, ".codex"))).toBe(false);

    const target = createCodexIntegration();
    await target.configureMcp!([{ name: "created", transport: "stdio", command: "true" }], {
      cwd,
      deployRoots: target.deployRoots,
      targetId: "codex",
    });

    expect(existsSync(join(cwd, ".codex", "config.toml"))).toBe(true);
    const raw = readFileSync(join(cwd, ".codex", "config.toml"), "utf8");
    expect(raw).toMatch(/created/);
  });

  test("maps static headers to http_headers", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-mcp-static-headers-"));
    mkdirSync(join(cwd, ".codex"), { recursive: true });

    const target = createCodexIntegration();
    await target.configureMcp!(
      [
        {
          name: "remote-headers",
          transport: "streamable-http",
          url: "https://example.test/mcp",
          headers: {
            "X-Static": "literal",
            "X-Project": "demo",
          },
        },
      ],
      { cwd, deployRoots: target.deployRoots, targetId: "codex" },
    );

    const doc = parseToml(readFileSync(join(cwd, ".codex", "config.toml"), "utf8")) as {
      mcp_servers: Record<string, Record<string, unknown>>;
    };
    expect(doc.mcp_servers["remote-headers"]!.http_headers).toEqual({
      "X-Static": "literal",
      "X-Project": "demo",
    });
    expect(doc.mcp_servers["remote-headers"]).not.toHaveProperty("bearer_token_env_var");
    expect(doc.mcp_servers["remote-headers"]).not.toHaveProperty("env_http_headers");
  });

  test("maps env-derived headers to env_http_headers without writing the token", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-mcp-env-headers-"));
    mkdirSync(join(cwd, ".codex"), { recursive: true });

    const target = createCodexIntegration();
    await target.configureMcp!(
      [
        {
          name: "remote-env-header",
          transport: "streamable-http",
          url: "https://example.test/mcp",
          headers: {
            "X-Tenant": "${env:TENANT_ID}",
            "X-Other": "${OTHER_TOKEN}",
            "X-Static": "literal",
          },
        },
      ],
      { cwd, deployRoots: target.deployRoots, targetId: "codex" },
    );

    const raw = readFileSync(join(cwd, ".codex", "config.toml"), "utf8");
    const doc = parseToml(raw) as {
      mcp_servers: Record<string, Record<string, unknown>>;
    };
    expect(doc.mcp_servers["remote-env-header"]!.env_http_headers).toEqual({
      "X-Tenant": "TENANT_ID",
      "X-Other": "OTHER_TOKEN",
    });
    expect(doc.mcp_servers["remote-env-header"]!.http_headers).toEqual({
      "X-Static": "literal",
    });
    expect(raw).not.toContain("${TENANT_ID}");
    expect(raw).not.toContain("${OTHER_TOKEN}");
  });

  test("maps Authorization Bearer env reference to bearer_token_env_var", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-mcp-bearer-"));
    mkdirSync(join(cwd, ".codex"), { recursive: true });

    const target = createCodexIntegration();
    await target.configureMcp!(
      [
        {
          name: "remote-bearer",
          transport: "streamable-http",
          url: "https://example.test/mcp",
          headers: {
            Authorization: "Bearer ${MCP_TOKEN}",
            "X-Static": "literal",
          },
        },
      ],
      { cwd, deployRoots: target.deployRoots, targetId: "codex" },
    );

    const raw = readFileSync(join(cwd, ".codex", "config.toml"), "utf8");
    const doc = parseToml(raw) as {
      mcp_servers: Record<string, Record<string, unknown>>;
    };
    expect(doc.mcp_servers["remote-bearer"]!.bearer_token_env_var).toBe("MCP_TOKEN");
    expect(doc.mcp_servers["remote-bearer"]!.http_headers).toEqual({
      "X-Static": "literal",
    });
    expect(doc.mcp_servers["remote-bearer"]).not.toHaveProperty("env_http_headers");
    expect(raw).not.toContain("${MCP_TOKEN}");
    expect(raw).not.toContain("Authorization");
  });

  test("skips unexpressible env header text with a diagnostic", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-mcp-unexpressible-"));
    mkdirSync(join(cwd, ".codex"), { recursive: true });

    const target = createCodexIntegration();
    const report = await target.configureMcp!(
      [
        {
          name: "remote-mixed",
          transport: "streamable-http",
          url: "https://example.test/mcp",
          headers: {
            "X-Mixed": "Token ${MCP_TOKEN}",
            "X-Static": "literal",
          },
        },
      ],
      { cwd, deployRoots: target.deployRoots, targetId: "codex" },
    );

    const raw = readFileSync(join(cwd, ".codex", "config.toml"), "utf8");
    const doc = parseToml(raw) as {
      mcp_servers: Record<string, Record<string, unknown>>;
    };
    expect(doc.mcp_servers["remote-mixed"]!.http_headers).toEqual({ "X-Static": "literal" });
    expect(raw).not.toContain("${MCP_TOKEN}");
    expect(
      report.diagnostics?.some(
        (d: { code?: string; server?: string }) =>
          d.code === "CODEX_MCP_HEADER_UNEXPRESSIBLE" && d.server === "remote-mixed",
      ),
    ).toBe(true);
  });

  test("MCP writes only project .codex/config.toml (not user-scope paths)", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-mcp-contain-"));
    mkdirSync(join(cwd, ".codex"), { recursive: true });

    const target = createCodexIntegration();
    await target.configureMcp!([{ name: "bounded", transport: "stdio", command: "true" }], {
      cwd,
      deployRoots: target.deployRoots,
      targetId: "codex",
    });

    expect(existsSync(join(cwd, ".codex", "config.toml"))).toBe(true);
    expect(existsSync(join(cwd, ".mcp.json"))).toBe(false);
    expect(existsSync(join(cwd, "config.toml"))).toBe(false);
  });
});
