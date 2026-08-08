import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCopilotIntegration } from "../src/index.ts";

describe("createCopilotIntegration configureMcp", () => {
  let cleanup: (() => void) | undefined;
  let previousHome: string | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    if (previousHome === undefined) delete process.env.COPILOT_HOME;
    else process.env.COPILOT_HOME = previousHome;
    previousHome = undefined;
  });

  function withHome(): { cwd: string; home: string } {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-copilot-unit-mcp-"));
    cleanup = () => rmSync(cwd, { recursive: true, force: true });
    previousHome = process.env.COPILOT_HOME;
    const home = join(cwd, "copilot-home");
    mkdirSync(home, { recursive: true });
    process.env.COPILOT_HOME = home;
    return { cwd, home };
  }

  test("translates placeholders under COPILOT_HOME and preserves unrelated servers", async () => {
    const { cwd, home } = withHome();
    process.env.API_TOKEN = "secret-must-not-leak";
    writeFileSync(
      join(home, "mcp-config.json"),
      `${JSON.stringify({ meta: "keep", mcpServers: { manual: { command: "m" } } }, null, 2)}\n`,
      "utf8",
    );

    const target = createCopilotIntegration();
    const report = await target.configureMcp!(
      [
        {
          name: "token-server",
          transport: "stdio",
          command: "node",
          env: {
            API_TOKEN: "${API_TOKEN}",
            OTHER: "${env:OTHER_TOKEN}",
            LEGACY: "<LEGACY_TOKEN>",
          },
        },
      ],
      { cwd, targetId: "copilot", deployRoots: target.deployRoots },
    );

    const path = join(home, "mcp-config.json");
    expect(report.configPath).toBe(path);
    const raw = readFileSync(path, "utf8");
    expect(raw).not.toMatch(/secret-must-not-leak/);
    const doc = JSON.parse(raw) as {
      meta?: string;
      mcpServers?: Record<string, { env?: Record<string, string>; command?: string }>;
    };
    expect(doc.meta).toBe("keep");
    expect(doc.mcpServers?.manual).toEqual({ command: "m" });
    expect(doc.mcpServers?.["token-server"]?.env).toEqual({
      API_TOKEN: "${API_TOKEN}",
      OTHER: "${OTHER_TOKEN}",
      LEGACY: "${LEGACY_TOKEN}",
    });
    expect(existsSync(join(cwd, ".vscode", "mcp.json"))).toBe(false);
  });
});
