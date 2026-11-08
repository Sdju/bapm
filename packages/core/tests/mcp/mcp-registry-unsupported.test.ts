/**
 * Registry-only MCP entries fail closed before any host config or MCP lock
 * inventory is written; direct `registry: false` entries keep working.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IntegrationRegistry } from "@b-apm/integration-api";
import { runInstall, type McpRegistryServerDetails } from "../../src/index.ts";
import {
  createFakePorts,
  createTempProject,
  getCreateIntegrationRegistry,
  getRegisterIntegration,
  importIntegrationApi,
  type TempProject,
} from "../install/ux-helpers.ts";

describe("MCP registry-only fail-closed", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  async function fakeHost(): Promise<{ registry: IntegrationRegistry; writes: string[] }> {
    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    const writes: string[] = [];
    getRegisterIntegration(
      api,
      registry,
    )({
      id: "x-registry-host",
      deployRoots: ["config"],
      detect: () => true,
      materialize: async () => ({ targetId: "x-registry-host", deployedFiles: [] }),
      configureMcp: async () => {
        writes.push("configureMcp");
        mkdirSync(join(project!.cwd, "config"), { recursive: true });
        writeFileSync(join(project!.cwd, "config", "mcp.json"), "{}\n", "utf8");
        return {
          targetId: "x-registry-host",
          configPath: "config/mcp.json",
          servers: [],
        };
      },
    });
    return { registry: registry as IntegrationRegistry, writes };
  }

  async function run(
    cwd: string,
    registry: IntegrationRegistry,
    trustTransitiveMcp = false,
    mcpRegistry?: { getServer(name: string): Promise<McpRegistryServerDetails> },
  ) {
    const ports = createFakePorts();
    return runInstall({
      cwd,
      frozen: false,
      forcedTarget: "x-registry-host",
      forceTarget: "x-registry-host",
      trustTransitiveMcp,
      integrationRegistry: registry,
      registry,
      ...(mcpRegistry ? { mcpRegistry } : {}),
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });
  }

  test("root registry-only entry fails with MCP_REGISTRY_UNSUPPORTED and writes no host config", async () => {
    project = createTempProject("bapm-mcp-registry-root-");
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: registry-root
version: 0.0.1
dependencies:
  apm: []
  mcp:
    - name: public-github
      registry: true
`,
      "utf8",
    );
    const { registry, writes } = await fakeHost();

    await expect(run(project.cwd, registry)).rejects.toMatchObject({
      code: "MCP_REGISTRY_UNSUPPORTED",
      message: expect.stringContaining("public-github"),
    });

    expect(writes).toEqual([]);
    expect(existsSync(join(project.cwd, "config", "mcp.json"))).toBe(false);
    const lockPath = join(project.cwd, "bapm.lock.yaml");
    if (existsSync(lockPath)) {
      expect(readFileSync(lockPath, "utf8")).not.toContain("public-github");
    }
  });

  test("dependency registry-only entry fails with MCP_REGISTRY_UNSUPPORTED before host write", async () => {
    project = createTempProject("bapm-mcp-registry-dep-");
    mkdirSync(join(project.cwd, "leaf"), { recursive: true });
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: registry-dep
version: 0.0.1
dependencies:
  apm:
    - path: ./leaf
`,
      "utf8",
    );
    writeFileSync(
      join(project.cwd, "leaf", "apm.yml"),
      `name: leaf
version: 0.0.1
dependencies:
  mcp:
    - name: dep-registry
      registry: true
`,
      "utf8",
    );
    const { registry, writes } = await fakeHost();

    await expect(run(project.cwd, registry, true)).rejects.toMatchObject({
      code: "MCP_REGISTRY_UNSUPPORTED",
      message: expect.stringContaining("dep-registry"),
    });

    expect(writes).toEqual([]);
    expect(existsSync(join(project.cwd, "config", "mcp.json"))).toBe(false);
    const lockPath = join(project.cwd, "bapm.lock.yaml");
    if (existsSync(lockPath)) {
      expect(readFileSync(lockPath, "utf8")).not.toContain("dep-registry");
    }
  });

  test("root registry-only entry resolves through the injected lookup and configures the host", async () => {
    project = createTempProject("bapm-mcp-registry-resolved-");
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: registry-resolved
version: 0.0.1
dependencies:
  apm: []
  mcp:
    - name: public-github
      registry: true
`,
      "utf8",
    );
    const { registry, writes } = await fakeHost();
    const lookup = {
      async getServer(name: string): Promise<McpRegistryServerDetails> {
        return {
          name,
          description: "resolved server",
          version: "1.0.0",
          repositoryUrl: null,
          websiteUrl: null,
          transports: ["stdio"],
          packages: [
            {
              registryType: "npm",
              identifier: "@acme/server",
              version: "1.0.0",
              runtimeHint: "npx",
            },
          ],
          remotes: [],
          packageDetails: [
            {
              registryType: "npm",
              identifier: "@acme/server",
              version: "1.0.0",
              runtimeHint: "npx",
              runtimeArguments: [],
              packageArguments: [],
              environmentVariables: [],
            },
          ],
        };
      },
    };

    await expect(run(project.cwd, registry, false, lookup)).resolves.toMatchObject({ ok: true });
    expect(writes).toEqual(["configureMcp"]);
    const lock = readFileSync(join(project.cwd, "bapm.lock.yaml"), "utf8");
    expect(lock).toContain("public-github");
    expect(lock).toContain("command: npx");
    expect(lock).toContain("@acme/server");
  });

  test("direct registry:false entries still configure when no registry-only entry exists", async () => {
    project = createTempProject("bapm-mcp-registry-direct-");
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: registry-direct
version: 0.0.1
dependencies:
  apm: []
  mcp:
    - name: direct-stdio
      registry: false
      transport: stdio
      command: echo
    - name: direct-http
      registry: false
      transport: http
      url: https://example.test/mcp
`,
      "utf8",
    );
    const { registry, writes } = await fakeHost();

    await expect(run(project.cwd, registry)).resolves.toMatchObject({ ok: true });
    expect(writes).toEqual(["configureMcp"]);
    expect(existsSync(join(project.cwd, "config", "mcp.json"))).toBe(true);
    expect(readFileSync(join(project.cwd, "bapm.lock.yaml"), "utf8")).toContain("direct-stdio");
  });
});
