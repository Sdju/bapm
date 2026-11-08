/**
 * Core global (user-scope) install contract:
 * - `only: "mcp"` is required
 * - integrations receive `scope: "global"` and choose user paths
 * - global detection uses `detectGlobal` (project `detect` is ignored)
 * - unsupported hosts fail closed with INSTALL_GLOBAL_UNSUPPORTED
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { runInstall } from "../../src/index.ts";
import type {
  ConfigureMcpContext,
  IntegrationRegistry,
  McpServerConfig,
} from "@b-apm/integration-api";
import {
  createFakePorts,
  createTempProject,
  getCreateIntegrationRegistry,
  getRegisterIntegration,
  importIntegrationApi,
  type TempProject,
} from "./ux-helpers.ts";

function writeMcpManifest(cwd: string): void {
  writeFileSync(
    join(cwd, "bapm.yml"),
    [
      "name: global-test",
      "version: 0.0.1",
      "dependencies:",
      "  apm: []",
      "  mcp:",
      "    - name: global-stdio",
      "      registry: false",
      "      transport: stdio",
      "      command: echo",
      "",
    ].join("\n"),
    "utf8",
  );
}

function globalTarget(args: {
  id: string;
  detect?: () => boolean;
  detectGlobal?: () => boolean;
  supportsGlobalMcp?: true;
  calls: Array<{ ctx?: ConfigureMcpContext; servers: McpServerConfig[] }>;
}) {
  return {
    id: args.id,
    deployRoots: [".agents", ".cursor"],
    detect: args.detect ?? (() => false),
    ...(args.detectGlobal ? { detectGlobal: args.detectGlobal } : {}),
    ...(args.supportsGlobalMcp ? { supportsGlobalMcp: args.supportsGlobalMcp } : {}),
    materialize: async () => ({ targetId: args.id, deployedFiles: [] }),
    configureMcp: async (
      servers: McpServerConfig[] | Record<string, McpServerConfig>,
      ctx?: ConfigureMcpContext,
    ) => {
      args.calls.push({
        ctx,
        servers: Array.isArray(servers) ? servers : Object.values(servers),
      });
      return { targetId: args.id, configPath: "/tmp/global/mcp.json", servers: ["global-stdio"] };
    },
  };
}

describe("core install global scope", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("global MCP forwards scope:global to configureMcp", async () => {
    project = createTempProject("bapm-core-global-");
    writeMcpManifest(project.cwd);
    const ports = createFakePorts();
    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    const calls: Array<{ ctx?: ConfigureMcpContext; servers: McpServerConfig[] }> = [];
    getRegisterIntegration(
      api,
      registry,
    )(globalTarget({ id: "x-global", supportsGlobalMcp: true, calls }));

    const result = await runInstall({
      cwd: project.cwd,
      scope: "global",
      only: "mcp",
      forcedTarget: "x-global",
      integrationRegistry: registry as IntegrationRegistry,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(result).toMatchObject({ ok: true, activeTargets: ["x-global"] });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.ctx?.scope).toBe("global");
    expect(calls[0]!.servers).toMatchObject([{ name: "global-stdio" }]);
  });

  test("global detection uses detectGlobal instead of project detect", async () => {
    project = createTempProject("bapm-core-global-detect-");
    writeMcpManifest(project.cwd);
    const ports = createFakePorts();
    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    const calls: Array<{ ctx?: ConfigureMcpContext; servers: McpServerConfig[] }> = [];
    getRegisterIntegration(
      api,
      registry,
    )(
      globalTarget({
        id: "x-global",
        detect: () => false,
        detectGlobal: () => true,
        supportsGlobalMcp: true,
        calls,
      }),
    );

    const result = await runInstall({
      cwd: project.cwd,
      scope: "global",
      only: "mcp",
      integrationRegistry: registry as IntegrationRegistry,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(result).toMatchObject({ ok: true, activeTargets: ["x-global"] });
    expect(calls).toHaveLength(1);
  });

  test("global install without only:mcp rejects before materialize", async () => {
    project = createTempProject("bapm-core-global-files-");
    writeMcpManifest(project.cwd);
    const ports = createFakePorts();
    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    let materializeCalls = 0;
    getRegisterIntegration(
      api,
      registry,
    )({
      ...globalTarget({ id: "x-global", supportsGlobalMcp: true, calls: [] }),
      materialize: async () => {
        materializeCalls += 1;
        return { targetId: "x-global", deployedFiles: [] };
      },
    });

    await expect(
      runInstall({
        cwd: project.cwd,
        scope: "global",
        forcedTarget: "x-global",
        integrationRegistry: registry as IntegrationRegistry,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      }),
    ).rejects.toThrow(/MCP only|next slice/i);
    expect(materializeCalls).toBe(0);
  });

  test("unsupported global host fails with a clear error", async () => {
    project = createTempProject("bapm-core-global-unsupported-");
    writeMcpManifest(project.cwd);
    const ports = createFakePorts();
    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    getRegisterIntegration(api, registry)(globalTarget({ id: "x-project-only", calls: [] }));

    await expect(
      runInstall({
        cwd: project.cwd,
        scope: "global",
        only: "mcp",
        forcedTarget: "x-project-only",
        integrationRegistry: registry as IntegrationRegistry,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      }),
    ).rejects.toThrow(/Global MCP is not supported.*x-project-only/i);
  });
});
