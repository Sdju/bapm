/**
 * configureMcp → .kiro/settings/mcp.json with translate placeholders; opt-in gate.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  ensureKiroDir,
  loadKiroIntegration,
  readJson,
  writeJson,
} from "./helpers.ts";

type KiroMcpDoc = {
  mcpServers?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};

describe("kiro configureMcp", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("writes mcpServers under .kiro/settings/mcp.json with translated env", async () => {
    const project = createTempProject("bapm-kiro-mcp-write-");
    cleanup = project.cleanup;
    ensureKiroDir(project.cwd);
    process.env.API_TOKEN = "super-secret-literal-should-not-appear";

    const target = loadKiroIntegration();
    const report = await target.configureMcp!(
      [
        {
          name: "token-server",
          transport: "stdio",
          command: "node",
          args: ["server.mjs"],
          env: {
            API_TOKEN: "${API_TOKEN}",
            OTHER: "${env:OTHER_TOKEN}",
            LEGACY: "<LEGACY_TOKEN>",
          },
        },
      ],
      { cwd: project.cwd, deployRoots: target.deployRoots, targetId: "kiro" },
    );

    const path = join(project.cwd, ".kiro", "settings", "mcp.json");
    expect(existsSync(path)).toBe(true);
    expect(report.configPath).toMatch(/\.kiro\/settings\/mcp\.json/);
    const raw = readFileSync(path, "utf8");
    expect(raw).not.toMatch(/super-secret-literal-should-not-appear/);
    const doc = JSON.parse(raw) as KiroMcpDoc;
    const env = doc.mcpServers?.["token-server"]?.env as Record<string, string> | undefined;
    expect(env?.API_TOKEN).toBe("${API_TOKEN}");
    expect(env?.OTHER).toBe("${OTHER_TOKEN}");
    expect(env?.LEGACY).toBe("${LEGACY_TOKEN}");
    expect(target.mcpEnvMode).toBe("translate");
  });

  test("skips MCP write when .kiro/ is absent (opt-in)", async () => {
    const project = createTempProject("bapm-kiro-mcp-skip-");
    cleanup = project.cleanup;

    const target = loadKiroIntegration();
    const report = await target.configureMcp!(
      [{ name: "s", transport: "stdio", command: "echo" }],
      { cwd: project.cwd, deployRoots: target.deployRoots, targetId: "kiro" },
    );

    expect(existsSync(join(project.cwd, ".kiro"))).toBe(false);
    expect(existsSync(join(project.cwd, ".kiro", "settings", "mcp.json"))).toBe(false);
    expect((report.diagnostics ?? []).length).toBeGreaterThan(0);
  });

  test("preserves unrelated servers on merge", async () => {
    const project = createTempProject("bapm-kiro-mcp-merge-");
    cleanup = project.cleanup;
    ensureKiroDir(project.cwd);
    mkdirSync(join(project.cwd, ".kiro", "settings"), { recursive: true });
    writeJson(join(project.cwd, ".kiro", "settings", "mcp.json"), {
      meta: "keep-me",
      mcpServers: {
        manual: { command: "manual-bin" },
      },
    });

    const target = loadKiroIntegration();
    await target.configureMcp!(
      [{ name: "owned", transport: "stdio", command: "node", args: ["server.mjs"] }],
      { cwd: project.cwd, deployRoots: target.deployRoots, targetId: "kiro" },
    );

    const doc = readJson(join(project.cwd, ".kiro", "settings", "mcp.json")) as KiroMcpDoc;
    expect(doc.meta).toBe("keep-me");
    expect(doc.mcpServers).toHaveProperty("manual");
    expect(doc.mcpServers).toHaveProperty("owned");
  });
});
