import { expect, test, describe, afterEach } from "vite-plus/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IntegrationRegistry } from "@b-apm/integration-api";
import { loadLockfile, runInstall } from "../../src/index.ts";
import {
  createFakePorts,
  createTempProject,
  getCreateIntegrationRegistry,
  getRegisterIntegration,
  importIntegrationApi,
  writeMcpLeafProject,
  type TempProject,
} from "./ux-helpers.ts";

describe("install MCP lock inventory", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("records the configuring non-Cursor target and its reported config path", async () => {
    project = createTempProject();
    writeMcpLeafProject(project.cwd, "target-keyed-mcp");
    writeFileSync(
      join(project.cwd, "bapm.lock.yaml"),
      `lockfile_version: "1"
dependencies: []
mcp_configs:
  cursor:
    path: .cursor/mcp.json
    servers: [legacy-server]
`,
      "utf8",
    );

    const ports = createFakePorts();
    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    getRegisterIntegration(
      api,
      registry,
    )({
      id: "x-acme-editor",
      deployRoots: ["config"],
      detect: () => true,
      materialize: async () => ({ deployedFiles: [] }),
      configureMcp: async () => {
        mkdirSync(join(project!.cwd, "config"), { recursive: true });
        writeFileSync(join(project!.cwd, "config", "mcp.json"), "{}\n", "utf8");
        return {
          targetId: "x-acme-editor",
          configPath: "config/mcp.json",
          servers: ["test-stdio-server"],
        };
      },
    });

    await expect(
      runInstall({
        cwd: project.cwd,
        frozen: false,
        forcedTarget: "x-acme-editor",
        forceTarget: "x-acme-editor",
        integrationRegistry: registry as IntegrationRegistry,
        registry: registry as IntegrationRegistry,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      }),
    ).resolves.toMatchObject({ ok: true });

    const document = loadLockfile({ cwd: project.cwd }).document as Record<string, unknown>;
    expect(document.mcp_configs).toMatchObject({
      "x-acme-editor": {
        path: "config/mcp.json",
        servers: ["test-stdio-server"],
      },
    });
    expect(document.mcp_configs).toMatchObject({
      cursor: {
        path: ".cursor/mcp.json",
        servers: ["legacy-server"],
      },
    });
    expect(document.mcp_target_servers).toMatchObject({
      "x-acme-editor": ["test-stdio-server"],
    });
  });
});
