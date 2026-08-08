/**
 * configureMcp → home ~/.copilot/mcp-config.json (COPILOT_HOME) with translate
 * placeholders; preserve unrelated servers; never .vscode/mcp.json
 * (integration-copilot-runtime acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, loadCopilotIntegration, readJson, writeJson } from "./helpers.ts";

type CopilotMcpDoc = {
  mcpServers?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};

describe("copilot configureMcp → home mcp-config.json", () => {
  let cleanup: (() => void) | undefined;
  let previousCopilotHome: string | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    if (previousCopilotHome === undefined) {
      delete process.env.COPILOT_HOME;
    } else {
      process.env.COPILOT_HOME = previousCopilotHome;
    }
    previousCopilotHome = undefined;
  });

  function withTempCopilotHome(): { cwd: string; copilotHome: string } {
    const project = createTempProject("bapm-copilot-mcp-");
    cleanup = project.cleanup;
    previousCopilotHome = process.env.COPILOT_HOME;
    const copilotHome = join(project.cwd, "copilot-home");
    mkdirSync(copilotHome, { recursive: true });
    process.env.COPILOT_HOME = copilotHome;
    return { cwd: project.cwd, copilotHome };
  }

  test("writes mcpServers stdio entry under COPILOT_HOME mcp-config.json", async () => {
    const { cwd, copilotHome } = withTempCopilotHome();

    const target = loadCopilotIntegration();
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
      { cwd, deployRoots: target.deployRoots, targetId: "copilot" },
    );

    const path = join(copilotHome, "mcp-config.json");
    expect(existsSync(path)).toBe(true);
    expect(String(report.configPath).length).toBeGreaterThan(0);
    expect(
      report.configPath === path ||
        report.configPath.endsWith("mcp-config.json") ||
        report.configPath.includes(".copilot/mcp-config.json"),
    ).toBe(true);

    const doc = readJson(path) as CopilotMcpDoc;
    expect(doc.mcpServers).toHaveProperty("test-stdio-server");
    const server = doc.mcpServers!["test-stdio-server"]!;
    expect(server.command === "echo" || server.type === "stdio").toBe(true);
    expect(existsSync(join(cwd, ".vscode", "mcp.json"))).toBe(false);
    expect(existsSync(join(cwd, ".mcp.json"))).toBe(false);
  });

  test("env placeholders are translated to ${VAR} and not baked from process.env", async () => {
    const { cwd, copilotHome } = withTempCopilotHome();
    process.env.API_TOKEN = "super-secret-literal-should-not-appear";

    const target = loadCopilotIntegration();
    await target.configureMcp!(
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
      { cwd, deployRoots: target.deployRoots, targetId: "copilot" },
    );

    const raw = readFileSync(join(copilotHome, "mcp-config.json"), "utf8");
    expect(raw).not.toMatch(/super-secret-literal-should-not-appear/);
    const doc = JSON.parse(raw) as CopilotMcpDoc;
    const env = doc.mcpServers?.["token-server"]?.env as Record<string, string> | undefined;
    expect(env?.API_TOKEN).toBe("${API_TOKEN}");
    expect(env?.OTHER).toMatch(/^\$\{OTHER_TOKEN\}$/);
    expect(env?.LEGACY).toMatch(/^\$\{LEGACY_TOKEN\}$/);
  });

  test("existing unrelated servers and top-level keys are preserved", async () => {
    const { cwd, copilotHome } = withTempCopilotHome();
    writeJson(join(copilotHome, "mcp-config.json"), {
      meta: "keep-me",
      mcpServers: {
        manual: { type: "stdio", command: "manual-bin" },
      },
    });

    const target = loadCopilotIntegration();
    await target.configureMcp!(
      [{ name: "owned", transport: "stdio", command: "node", args: ["server.mjs"] }],
      { cwd, deployRoots: target.deployRoots, targetId: "copilot" },
    );

    const doc = readJson(join(copilotHome, "mcp-config.json")) as CopilotMcpDoc;
    expect(doc.meta).toBe("keep-me");
    expect(doc.mcpServers!["manual"]).toEqual({ type: "stdio", command: "manual-bin" });
    expect(doc.mcpServers!["owned"]).toMatchObject({ command: "node" });
  });
});
