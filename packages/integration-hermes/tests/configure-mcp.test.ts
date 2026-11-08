/**
 * configureMcp → $HERMES_HOME/config.yaml (`mcp_servers` YAML block).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { createTempProject, loadHermesIntegration } from "./helpers.ts";

type HermesDoc = {
  mcp_servers?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};

describe("hermes configureMcp → $HERMES_HOME/config.yaml", () => {
  let cleanup: (() => void) | undefined;
  let previousHermesHome: string | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    if (previousHermesHome === undefined) delete process.env.HERMES_HOME;
    else process.env.HERMES_HOME = previousHermesHome;
    previousHermesHome = undefined;
  });

  function withTempHermesHome(): { cwd: string; hermesHome: string; configPath: string } {
    const project = createTempProject("bapm-hermes-mcp-");
    cleanup = project.cleanup;
    previousHermesHome = process.env.HERMES_HOME;
    const hermesHome = join(project.cwd, "hermes-home");
    mkdirSync(hermesHome, { recursive: true });
    process.env.HERMES_HOME = hermesHome;
    return { cwd: project.cwd, hermesHome, configPath: join(hermesHome, "config.yaml") };
  }

  test("writes stdio/remote servers under mcp_servers with enabled=true", async () => {
    const { cwd, configPath } = withTempHermesHome();

    const target = loadHermesIntegration();
    const report = await target.configureMcp!(
      [
        {
          name: "stdio-server",
          transport: "stdio",
          command: "node",
          args: ["server.mjs"],
          env: { API_TOKEN: "literal-token" },
        },
        {
          name: "remote-server",
          transport: "http",
          url: "https://example.invalid/mcp",
          headers: { Authorization: "Bearer secret" },
        },
      ],
      { cwd, deployRoots: target.deployRoots, targetId: "hermes" },
    );

    expect(report.configPath).toBe(configPath);
    expect(report.servers).toEqual(["stdio-server", "remote-server"]);
    const doc = parseYaml(readFileSync(configPath, "utf8")) as HermesDoc;
    expect(doc.mcp_servers?.["stdio-server"]).toEqual({
      command: "node",
      args: ["server.mjs"],
      env: { API_TOKEN: "literal-token" },
      enabled: true,
    });
    expect(doc.mcp_servers?.["remote-server"]).toEqual({
      url: "https://example.invalid/mcp",
      headers: { Authorization: "Bearer secret" },
      enabled: true,
    });
    expect(statSync(configPath).mode & 0o077).toBe(0);
  });

  test("preserves unrelated top-level Hermes keys and foreign servers", async () => {
    const { cwd, configPath } = withTempHermesHome();
    writeFileSync(
      configPath,
      [
        "model:",
        "  provider: nous",
        "telegram:",
        "  token: keep-me",
        "mcp_servers:",
        "  manual:",
        "    command: manual-bin",
        "    enabled: true",
        "",
      ].join("\n"),
      "utf8",
    );

    const target = loadHermesIntegration();
    await target.configureMcp!([{ name: "owned", transport: "stdio", command: "node" }], {
      cwd,
      deployRoots: target.deployRoots,
      targetId: "hermes",
    });

    const doc = parseYaml(readFileSync(configPath, "utf8")) as HermesDoc;
    expect(doc.model).toEqual({ provider: "nous" });
    expect(doc.telegram).toEqual({ token: "keep-me" });
    expect(doc.mcp_servers?.manual).toEqual({ command: "manual-bin", enabled: true });
    expect(doc.mcp_servers?.owned).toEqual({ command: "node", enabled: true });
  });

  test("managed server names are pruned without touching foreign entries", async () => {
    const { cwd, configPath } = withTempHermesHome();
    writeFileSync(
      configPath,
      [
        "mcp_servers:",
        "  stale:",
        "    command: old-bin",
        "  manual:",
        "    command: manual-bin",
        "",
      ].join("\n"),
      "utf8",
    );

    const target = loadHermesIntegration();
    await target.configureMcp!([], {
      cwd,
      deployRoots: target.deployRoots,
      targetId: "hermes",
      managedServers: ["stale"],
    });

    const doc = parseYaml(readFileSync(configPath, "utf8")) as HermesDoc;
    expect(doc.mcp_servers?.stale).toBeUndefined();
    expect(doc.mcp_servers?.manual).toEqual({ command: "manual-bin" });
  });

  test("malformed YAML fails closed and is not overwritten", async () => {
    const { cwd, configPath } = withTempHermesHome();
    writeFileSync(configPath, "mcp_servers: [unclosed\n", "utf8");

    const target = loadHermesIntegration();
    await expect(
      target.configureMcp!([{ name: "owned", transport: "stdio", command: "node" }], {
        cwd,
        deployRoots: target.deployRoots,
        targetId: "hermes",
      }),
    ).rejects.toThrow(/malformed YAML/);
    expect(readFileSync(configPath, "utf8")).toBe("mcp_servers: [unclosed\n");
  });
});
