/**
 * configureMcp → user-scope JetBrains Copilot mcp.json (`servers` key).
 * Path mirrors APM adapters/client/intellij.py: $XDG_CONFIG_HOME on POSIX.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, loadIntellijIntegration, readJson, writeJson } from "./helpers.ts";

type IntellijDoc = {
  servers?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};

describe("intellij configureMcp → user-scope mcp.json", () => {
  let cleanup: (() => void) | undefined;
  let previousXdg: string | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    if (previousXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previousXdg;
    previousXdg = undefined;
  });

  function withTempConfigHome(): { cwd: string; configHome: string; configPath: string } {
    const project = createTempProject("bapm-intellij-mcp-");
    cleanup = project.cleanup;
    previousXdg = process.env.XDG_CONFIG_HOME;
    const configHome = join(project.cwd, "xdg-config");
    mkdirSync(configHome, { recursive: true });
    process.env.XDG_CONFIG_HOME = configHome;
    return {
      cwd: project.cwd,
      configHome,
      configPath: join(configHome, "github-copilot", "intellij", "mcp.json"),
    };
  }

  test("writes http servers under XDG github-copilot/intellij/mcp.json", async () => {
    const { cwd, configPath } = withTempConfigHome();

    const target = loadIntellijIntegration();
    const report = await target.configureMcp!(
      [
        {
          name: "managed-server",
          transport: "http",
          url: "https://example.invalid/mcp",
        },
      ],
      { cwd, deployRoots: target.deployRoots, targetId: "intellij" },
    );

    expect(report.configPath).toBe(configPath);
    expect(report.servers).toEqual(["managed-server"]);
    const doc = readJson(configPath) as IntellijDoc;
    expect(doc.servers?.["managed-server"]).toEqual({
      type: "http",
      tools: ["*"],
      id: "",
      url: "https://example.invalid/mcp",
    });
    expect(existsSync(join(cwd, ".idea", "mcp.json"))).toBe(false);
    expect(existsSync(join(cwd, ".vscode", "mcp.json"))).toBe(false);
  });

  test("stdio env placeholders use ${env:VAR} and never bake secrets", async () => {
    const { cwd, configPath } = withTempConfigHome();
    process.env.API_TOKEN = "super-secret-literal-should-not-appear";

    const target = loadIntellijIntegration();
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
      { cwd, deployRoots: target.deployRoots, targetId: "intellij" },
    );

    const raw = readFileSync(configPath, "utf8");
    expect(raw).not.toMatch(/super-secret-literal-should-not-appear/);
    const doc = JSON.parse(raw) as IntellijDoc;
    expect(doc.servers?.["token-server"]).toMatchObject({
      type: "local",
      command: "node",
      args: ["server.mjs"],
    });
    expect(doc.servers?.["token-server"]?.env).toEqual({
      API_TOKEN: "${env:API_TOKEN}",
      OTHER: "${env:OTHER_TOKEN}",
      LEGACY: "${env:LEGACY_TOKEN}",
    });
  });

  test("existing servers/top-level keys are preserved and managed names pruned", async () => {
    const { cwd, configPath } = withTempConfigHome();
    writeJson(configPath, {
      meta: "keep-me",
      servers: {
        manual: { type: "local", command: "manual-bin" },
        stale: { type: "local", command: "old-bin" },
      },
    });

    const target = loadIntellijIntegration();
    await target.configureMcp!(
      [{ name: "owned", transport: "stdio", command: "node", args: ["server.mjs"] }],
      {
        cwd,
        deployRoots: target.deployRoots,
        targetId: "intellij",
        managedServers: ["stale"],
      },
    );

    const doc = readJson(configPath) as IntellijDoc;
    expect(doc.meta).toBe("keep-me");
    expect(doc.servers?.manual).toEqual({ type: "local", command: "manual-bin" });
    expect(doc.servers?.stale).toBeUndefined();
    expect(doc.servers?.owned).toMatchObject({ command: "node" });
  });

  test("native JSONC comments and trailing commas are read without loss", async () => {
    const { cwd, configPath } = withTempConfigHome();
    mkdirSync(join(configPath, ".."), { recursive: true });
    writeFileSync(
      configPath,
      `{
  // JetBrains plugin generated file
  "servers": {
    "manual": { "command": "keep", },
  },
}
`,
      "utf8",
    );

    const target = loadIntellijIntegration();
    await target.configureMcp!([{ name: "owned", transport: "stdio", command: "node" }], {
      cwd,
      deployRoots: target.deployRoots,
      targetId: "intellij",
    });

    const doc = readJson(configPath) as IntellijDoc;
    expect(doc.servers?.manual).toEqual({ command: "keep" });
    expect(doc.servers?.owned).toMatchObject({ command: "node" });
  });

  test("malformed JSON fails closed and is not overwritten", async () => {
    const { cwd, configPath } = withTempConfigHome();
    mkdirSync(join(configPath, ".."), { recursive: true });
    writeFileSync(configPath, "{ not json", "utf8");

    const target = loadIntellijIntegration();
    await expect(
      target.configureMcp!([{ name: "owned", transport: "stdio", command: "node" }], {
        cwd,
        deployRoots: target.deployRoots,
        targetId: "intellij",
      }),
    ).rejects.toThrow(/malformed JSON/);
    expect(readFileSync(configPath, "utf8")).toBe("{ not json");
  });
});
