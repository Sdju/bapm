/**
 * Install bake dispatch honors BapmIntegration.mcpEnvMode (bake vs translate).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IntegrationRegistry, McpServerConfig } from "@b-apm/integration-api";
import { bakeMcpStringMap } from "../../src/modules/Mcp/bake.ts";
import { runInstall } from "../../src/index.ts";
import {
  createFakePorts,
  createTempProject,
  getCreateIntegrationRegistry,
  getRegisterIntegration,
  importIntegrationApi,
  type TempProject,
} from "../install/ux-helpers.ts";

describe("mcpEnvMode install bake dispatch", () => {
  let project: TempProject | undefined;
  let previousToken: string | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
    if (previousToken === undefined) delete process.env.API_TOKEN;
    else process.env.API_TOKEN = previousToken;
    previousToken = undefined;
  });

  test("bakeMcpStringMap translate leaves APM placeholders and still bakes {bake:}", () => {
    const env = { API_TOKEN: "secret", BAKED: "literal" };
    expect(
      bakeMcpStringMap(
        { A: "${API_TOKEN}", B: "${env:API_TOKEN}", C: "<API_TOKEN>", D: "{bake:BAKED}" },
        { env, mode: "translate" },
      ),
    ).toEqual({
      A: "${API_TOKEN}",
      B: "${env:API_TOKEN}",
      C: "<API_TOKEN>",
      D: "literal",
    });
    expect(bakeMcpStringMap({ A: "${API_TOKEN}" }, { env, mode: "bake" })).toEqual({
      A: "secret",
    });
  });

  test("install: Cursor bake receives literals; translate target receives placeholders", async () => {
    previousToken = process.env.API_TOKEN;
    process.env.API_TOKEN = "super-secret-literal";

    project = createTempProject("bapm-mcp-env-mode-");
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    mkdirSync(join(project.cwd, "leaf"), { recursive: true });
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: mcp-env-mode
version: 0.0.1
dependencies:
  apm:
    - path: ./leaf
  mcp:
    - name: token-server
      registry: false
      transport: stdio
      command: node
      args: ["server.mjs"]
      env:
        API_TOKEN: "\${API_TOKEN}"
`,
      "utf8",
    );
    writeFileSync(
      join(project.cwd, "leaf", "apm.yml"),
      `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );

    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    const register = getRegisterIntegration(api, registry);

    let cursorEnv: Record<string, string> | undefined;
    let translateEnv: Record<string, string> | undefined;

    register({
      id: "cursor",
      deployRoots: [".cursor"],
      detect: () => true,
      materialize: async () => ({ targetId: "cursor", deployedFiles: [] }),
      configureMcp: async (servers: McpServerConfig[] | Record<string, McpServerConfig>) => {
        const list = Array.isArray(servers) ? servers : Object.values(servers);
        cursorEnv = list[0]?.env;
        mkdirSync(join(project!.cwd, ".cursor"), { recursive: true });
        writeFileSync(join(project!.cwd, ".cursor", "mcp.json"), "{}\n", "utf8");
        return { targetId: "cursor", configPath: ".cursor/mcp.json", servers: ["token-server"] };
      },
    });
    register({
      id: "translate-host",
      deployRoots: [".agents"],
      mcpEnvMode: "translate",
      detect: () => true,
      materialize: async () => ({ targetId: "translate-host", deployedFiles: [] }),
      configureMcp: async (servers: McpServerConfig[] | Record<string, McpServerConfig>) => {
        const list = Array.isArray(servers) ? servers : Object.values(servers);
        translateEnv = list[0]?.env;
        return {
          targetId: "translate-host",
          configPath: "/tmp/translate-mcp.json",
          servers: ["token-server"],
        };
      },
    });

    const ports = createFakePorts();
    await expect(
      runInstall({
        cwd: project.cwd,
        frozen: false,
        only: "mcp",
        forcedTarget: "cursor",
        forceTarget: "cursor",
        // Also activate translate-host via multi-active: use forced + registry detect path.
        // runInstall with forcedTarget selects one; register both and call twice is clearer.
        integrationRegistry: registry as IntegrationRegistry,
        registry: registry as IntegrationRegistry,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      }),
    ).resolves.toMatchObject({ ok: true });

    expect(cursorEnv?.API_TOKEN).toBe("super-secret-literal");

    // Second install pass for translate-mode host alone.
    cursorEnv = undefined;
    await expect(
      runInstall({
        cwd: project.cwd,
        frozen: false,
        only: "mcp",
        forcedTarget: "translate-host",
        forceTarget: "translate-host",
        integrationRegistry: registry as IntegrationRegistry,
        registry: registry as IntegrationRegistry,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      }),
    ).resolves.toMatchObject({ ok: true });

    expect(translateEnv?.API_TOKEN).toBe("${API_TOKEN}");
  });
});
