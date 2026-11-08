/**
 * Multi-active install configures MCP for every eligible target and records all
 * of them in the lock inventory.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadLockfile, runInstall } from "../../src/index.ts";
import type { IntegrationRegistry, McpServerConfig } from "@b-apm/integration-api";
import {
  createFakePorts,
  createTempProject,
  getCreateIntegrationRegistry,
  getRegisterIntegration,
  importIntegrationApi,
  type TempProject,
} from "./ux-helpers.ts";

describe("install configures MCP for every active target", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("two active targets both receive configureMcp and appear in mcp_configs", async () => {
    project = createTempProject("bapm-mcp-multi-");
    const cwd = project.cwd;
    mkdirSync(join(cwd, "leaf"), { recursive: true });
    writeFileSync(
      join(cwd, "bapm.yml"),
      `name: multi-mcp
version: 0.0.1
active:
  target:
    - x-first-host
    - x-second-host
dependencies:
  apm:
    - path: ./leaf
  mcp:
    - name: shared-server
      registry: false
      transport: stdio
      command: echo
`,
      "utf8",
    );
    writeFileSync(
      join(cwd, "leaf", "apm.yml"),
      "name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n",
      "utf8",
    );

    const calls: string[] = [];
    const ports = createFakePorts();
    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    const register = getRegisterIntegration(api, registry);

    for (const [id, configDir] of [
      ["x-first-host", "first"],
      ["x-second-host", "second"],
    ] as const) {
      register({
        id,
        deployRoots: [`.${configDir}`],
        detect: () => false,
        materialize: async () => ({ targetId: id, deployedFiles: [] }),
        configureMcp: async (servers: McpServerConfig[] | Record<string, McpServerConfig>) => {
          calls.push(id);
          mkdirSync(join(cwd, configDir), { recursive: true });
          writeFileSync(join(cwd, configDir, "mcp.json"), "{}\n", "utf8");
          const list = Array.isArray(servers) ? servers : Object.values(servers);
          return {
            targetId: id,
            configPath: `${configDir}/mcp.json`,
            servers: list.map((server) => server.name),
          };
        },
      });
    }

    await expect(
      runInstall({
        cwd,
        frozen: false,
        integrationRegistry: registry as IntegrationRegistry,
        registry: registry as IntegrationRegistry,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      }),
    ).resolves.toMatchObject({ ok: true });

    expect(calls).toEqual(["x-first-host", "x-second-host"]);

    const document = loadLockfile({ cwd }).document as Record<string, unknown>;
    expect(document.mcp_configs).toMatchObject({
      "x-first-host": { path: "first/mcp.json", servers: ["shared-server"] },
      "x-second-host": { path: "second/mcp.json", servers: ["shared-server"] },
    });
    expect(document.mcp_target_servers).toMatchObject({
      "x-first-host": ["shared-server"],
      "x-second-host": ["shared-server"],
    });
  });
});
