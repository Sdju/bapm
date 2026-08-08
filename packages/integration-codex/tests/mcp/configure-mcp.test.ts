/**
 * configureMcp → `.codex/config.toml` `mcp_servers` (TOML);
 * SSE reject; malformed skip; preserve unrelated; mkdir-on-write; no user-scope
 * (promoted from integration-codex-runtime acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
