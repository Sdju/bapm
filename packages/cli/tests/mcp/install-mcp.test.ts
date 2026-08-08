/**
 * M9 MUST: Cursor MCP deploy on install → .cursor/mcp.json + lock mcp_*.
 * Specs: cursor-mcp-deploy, install-pipeline. Checklist D §1–5, 7.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectKnownFlags,
  hasLock,
  linkCursorIntegration,
  mcpJsonPath,
  readLockText,
  readMcpServers,
  runInProject,
  writeDirectMcpProject,
  type TempProject,
} from "./helpers.ts";

describe("CLI M9 Cursor MCP deploy on install", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("direct MCP + --target cursor → .cursor/mcp.json mcpServers; exit 0", async () => {
    project = createTempProject();
    writeDirectMcpProject(project.cwd, { withCursorDir: true });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);
    expect(result).toBe(0);

    const servers = readMcpServers(project.cwd);
    expect(servers).toHaveProperty("test-stdio-server");
    const entry = servers["test-stdio-server"] as Record<string, unknown>;
    expect(entry.command === "echo" || entry.type === "stdio").toBe(true);
  });

  test("second install keeps owned mcpServers keys stable (idempotent)", async () => {
    project = createTempProject();
    writeDirectMcpProject(project.cwd);

    const first = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(first.combined);
    expect(first.result).toBe(0);
    const servers = readMcpServers(project.cwd);
    expect(servers).toHaveProperty("test-stdio-server");
    const before = JSON.stringify(servers);

    const second = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(second.combined);
    expect(second.result).toBe(0);
    expect(JSON.stringify(readMcpServers(project.cwd))).toBe(before);
  });

  test("lock lists MCP inventory after successful MCP install", async () => {
    project = createTempProject();
    writeDirectMcpProject(project.cwd);

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(hasLock(project.cwd)).toBe(true);
    expect(readLockText(project.cwd)).toMatch(
      /mcp_servers|mcp_configs|mcp_target_servers|test-stdio-server/i,
    );
  });

  test("MCP write stays under .cursor/ (no escape)", async () => {
    project = createTempProject();
    writeDirectMcpProject(project.cwd);

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(existsSync(mcpJsonPath(project.cwd))).toBe(true);
    expect(existsSync(join(project.cwd, "mcp.json"))).toBe(false);
    expect(existsSync(join(project.cwd, ".mcp.json"))).toBe(false);
  });

  test("explicit target may configure MCP without a pre-existing .cursor directory", async () => {
    project = createTempProject();
    writeDirectMcpProject(project.cwd, { withCursorDir: false });
    expect(existsSync(join(project.cwd, ".cursor"))).toBe(false);

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, ".cursor"))).toBe(true);
    expect(existsSync(mcpJsonPath(project.cwd))).toBe(true);
  });

  test("no MCP deps → install success does not require mcp.json (M5 regression)", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    mkdirSync(join(project.cwd, "leaf"), { recursive: true });
    const { writeFileSync } = await import("node:fs");
    const spec = linkCursorIntegration(project.cwd);
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: m9-no-mcp\nversion: 0.0.1\ntargets:\n  cursor: "${spec}"\ndependencies:\n  apm:\n    - path: ./leaf\n`,
      "utf8",
    );
    writeFileSync(
      join(project.cwd, "leaf", "apm.yml"),
      `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );

    const { result, combined } = await runInProject(project.cwd, ["install"]);
    expectKnownFlags(combined);
    expect(result).toBe(0);
    // Absence is fine; presence without MCP deps is not required.
    expect(hasLock(project.cwd) || existsSync(join(project.cwd, "apm_modules"))).toBe(true);
  });
});
