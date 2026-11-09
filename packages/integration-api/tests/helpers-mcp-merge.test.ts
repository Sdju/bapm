import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { mergeMcpServers, normalizeNamedEntries, skipMcpWhenDirMissing } from "../src/index.ts";

describe("normalizeNamedEntries", () => {
  test("normalizes arrays and keyed records", () => {
    expect(normalizeNamedEntries([{ name: " a " }, { name: "" }, {}])).toEqual([{ name: "a" }]);
    expect(normalizeNamedEntries({ alpha: { command: "a" }, beta: { name: "b" } })).toEqual([
      { command: "a", name: "alpha" },
      { name: "b" },
    ]);
  });
});

describe("mergeMcpServers", () => {
  test("replaces entries and preserves unrelated document keys", () => {
    const result = mergeMcpServers({
      document: { mcpServers: { old: { command: "old" }, foreign: { command: "keep" } }, meta: 1 },
      incoming: { old: { command: "new" } },
      managedServers: ["old"],
    });
    expect(result.document).toEqual({
      mcpServers: { old: { command: "new" }, foreign: { command: "keep" } },
      meta: 1,
    });
    expect(result.servers).toEqual(["old"]);
  });

  test("shallow merge keeps prior fields and strips adapter keys", () => {
    const result = mergeMcpServers({
      document: { mcpServers: { srv: { command: "old", keep: true } } },
      incoming: { srv: { command: "new", format: "agent-plugin", packageName: "pkg" } },
      merge: "shallow",
      stripKeys: ["format", "packageName"],
    });
    expect(result.document.mcpServers).toEqual({
      srv: { command: "new", keep: true },
    });
  });

  test("supports alternate keys and prunes managed names", () => {
    const result = mergeMcpServers({
      document: { mcp_servers: { stale: {} } },
      key: "mcp_servers",
      incoming: { next: {} },
      managedServers: ["stale"],
    });
    expect(result.document.mcp_servers).toEqual({ next: {} });
    expect(result.removed).toEqual(["stale"]);
  });

  test("shallow merge replaces malformed array prior values", () => {
    const result = mergeMcpServers({
      document: { mcpServers: { srv: ["bad"] } },
      incoming: { srv: { command: "node" } },
      merge: "shallow",
    });
    expect(result.document.mcpServers).toEqual({ srv: { command: "node" } });
  });
});

describe("skipMcpWhenDirMissing", () => {
  test("returns the standard warn report when the host dir is absent", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-skip-"));
    const report = skipMcpWhenDirMissing({
      cwd,
      dir: ".kiro",
      targetId: "kiro",
      code: "KIRO_MCP_SKIP_NO_KIRO_DIR",
      label: "kiro",
      configPath: ".kiro/settings/mcp.json",
    });
    expect(report?.servers).toEqual([]);
    expect(report?.diagnostics?.[0]).toMatchObject({
      code: "KIRO_MCP_SKIP_NO_KIRO_DIR",
      warn: true,
      dir: ".kiro/",
    });
  });

  test("returns undefined when the host dir exists", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-skip-"));
    mkdirSync(join(cwd, ".kiro"), { recursive: true });
    expect(
      skipMcpWhenDirMissing({
        cwd,
        dir: ".kiro",
        targetId: "kiro",
        code: "X",
        label: "kiro",
        configPath: "x",
      }),
    ).toBeUndefined();
  });
});
