/**
 * Core global (user-scope) install contract:
 * - `deployCwd` separates the global manifest/lock root from home harness writes
 * - integrations receive `scope: "global"` and choose user paths
 * - global detection uses `detectGlobal` (project `detect` is ignored)
 * - unsupported file/MCP hosts fail closed with INSTALL_GLOBAL_UNSUPPORTED
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runInstall } from "../../src/index.ts";
import type {
  AttributedPrimitiveSet,
  ConfigureMcpContext,
  IntegrationRegistry,
  MaterializeContext,
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
  supportsGlobalFiles?: true;
  calls: Array<{ ctx?: ConfigureMcpContext; servers: McpServerConfig[] }>;
}) {
  return {
    id: args.id,
    deployRoots: [".agents", ".cursor"],
    detect: args.detect ?? (() => false),
    ...(args.detectGlobal ? { detectGlobal: args.detectGlobal } : {}),
    ...(args.supportsGlobalMcp ? { supportsGlobalMcp: args.supportsGlobalMcp } : {}),
    ...(args.supportsGlobalFiles ? { supportsGlobalFiles: args.supportsGlobalFiles } : {}),
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

  test("global install materializes files under deployCwd, keeps manifest/lock under cwd", async () => {
    project = createTempProject("bapm-core-global-files-");
    const home = createTempProject("bapm-core-global-home-");
    try {
      writeMcpManifest(project.cwd);
      const ports = createFakePorts();
      const api = await importIntegrationApi();
      const registry = getCreateIntegrationRegistry(api)();
      let materializeCalls = 0;
      getRegisterIntegration(
        api,
        registry,
      )({
        ...globalTarget({
          id: "x-global",
          supportsGlobalMcp: true,
          supportsGlobalFiles: true,
          calls: [],
        }),
        materialize: async (_primitives: AttributedPrimitiveSet, ctx?: MaterializeContext) => {
          materializeCalls += 1;
          expect(ctx?.scope).toBe("global");
          expect(ctx?.cwd).toBe(home.cwd);
          const rel = ".cursor/agents/global-agent.md";
          mkdirSync(join(ctx!.cwd, ".cursor", "agents"), { recursive: true });
          writeFileSync(join(ctx!.cwd, rel), "# global agent\n", "utf8");
          return {
            targetId: "x-global",
            deployedFiles: [{ path: rel, primitive: { name: "global-agent" } }],
          };
        },
      });

      const result = await runInstall({
        cwd: project.cwd,
        deployCwd: home.cwd,
        scope: "global",
        forcedTarget: "x-global",
        integrationRegistry: registry as IntegrationRegistry,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      });

      expect(result.ok).toBe(true);
      expect(materializeCalls).toBe(1);
      expect(existsSync(join(home.cwd, ".cursor", "agents", "global-agent.md"))).toBe(true);
      // No project-shaped harness files in the global manifest root.
      expect(existsSync(join(project.cwd, ".cursor"))).toBe(false);
      const lockPath = join(project.cwd, "bapm.lock.yaml");
      expect(result.lockPath).toBe(lockPath);
      const lock = readFileSync(lockPath, "utf8");
      expect(lock).toContain(".cursor/agents/global-agent.md");
      expect(lock).not.toContain(home.cwd.replaceAll("\\", "/"));
    } finally {
      home.cleanup();
    }
  });

  test("global file install rejects a host without supportsGlobalFiles before materialize", async () => {
    project = createTempProject("bapm-core-global-unsupported-files-");
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
    ).rejects.toThrow(/Global file install is not supported.*x-global/i);
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
