/**
 * `origin` / `packageName` are internal provenance and must not reach hosts.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IntegrationRegistry, McpServerConfig } from "@b-apm/integration-api";
import { runInstall } from "../../src/index.ts";
import {
  createFakePorts,
  createTempProject,
  getCreateIntegrationRegistry,
  getRegisterIntegration,
  importIntegrationApi,
  type TempProject,
} from "./ux-helpers.ts";

describe("install strips internal MCP provenance", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("configureMcp input has no origin or packageName; lock stays clean", async () => {
    project = createTempProject("bapm-mcp-origin-");
    const cwd = project.cwd;
    mkdirSync(join(cwd, "leaf"), { recursive: true });
    writeFileSync(
      join(cwd, "bapm.yml"),
      `name: origin-strip
version: 0.0.1
dependencies:
  apm:
    - path: ./leaf
  mcp:
    - name: direct-server
      registry: false
      transport: stdio
      command: echo
`,
      "utf8",
    );
    writeFileSync(
      join(cwd, "leaf", "apm.yml"),
      `name: leaf
version: 0.0.1
dependencies:
  mcp:
    - name: dep-server
      registry: false
      transport: stdio
      command: echo
`,
      "utf8",
    );

    let received: McpServerConfig[] | Record<string, McpServerConfig> | undefined;
    const ports = createFakePorts();
    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    getRegisterIntegration(
      api,
      registry,
    )({
      id: "x-rest-copy-host",
      deployRoots: ["config"],
      detect: () => true,
      materialize: async () => ({ deployedFiles: [] }),
      configureMcp: async (servers: McpServerConfig[] | Record<string, McpServerConfig>) => {
        received = servers;
        mkdirSync(join(cwd, "config"), { recursive: true });
        writeFileSync(join(cwd, "config", "mcp.json"), "{}\n", "utf8");
        return {
          targetId: "x-rest-copy-host",
          configPath: "config/mcp.json",
          servers: ["direct-server", "dep-server"],
        };
      },
    });

    await expect(
      runInstall({
        cwd,
        frozen: false,
        trustTransitiveMcp: true,
        forcedTarget: "x-rest-copy-host",
        forceTarget: "x-rest-copy-host",
        integrationRegistry: registry as IntegrationRegistry,
        registry: registry as IntegrationRegistry,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      }),
    ).resolves.toMatchObject({ ok: true });

    const list = Array.isArray(received) ? received : Object.values(received ?? {});
    expect(list.map((s) => s.name).sort()).toEqual(["dep-server", "direct-server"]);
    for (const server of list) {
      expect(Object.hasOwn(server, "origin")).toBe(false);
      expect(Object.hasOwn(server, "packageName")).toBe(false);
    }

    const lock = readFileSync(join(cwd, "bapm.lock.yaml"), "utf8");
    expect(lock).not.toMatch(/^\s*origin:/m);
    expect(lock).not.toMatch(/^\s*packageName:/m);
    // Dependency provenance is still represented in the lock inventory.
    expect(lock).toContain("package: leaf");
  });
});
