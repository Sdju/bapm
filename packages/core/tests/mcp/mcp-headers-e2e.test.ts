/**
 * HTTP/SSE headers survive collect → bake → configureMcp, while the lock keeps
 * the authored `${VAR}` placeholder instead of the baked secret.
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
} from "../install/ux-helpers.ts";

const SECRET = "header-secret-4d2a";
const ENV_NAME = "BAPM_MCP_HEADER_TOKEN";

describe("MCP headers end-to-end", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("configureMcp receives baked headers and lock keeps the placeholder", async () => {
    project = createTempProject("bapm-mcp-headers-");
    const cwd = project.cwd;
    writeFileSync(
      join(cwd, "bapm.yml"),
      `name: headers-e2e
version: 0.0.1
dependencies:
  mcp:
    - name: docs
      registry: false
      transport: http
      url: https://mcp.example.com/
      headers:
        Authorization: "Bearer \${${ENV_NAME}}"
        X-Static: literal
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
      id: "x-headers-host",
      deployRoots: ["config"],
      detect: () => true,
      materialize: async () => ({ deployedFiles: [] }),
      configureMcp: async (servers: McpServerConfig[] | Record<string, McpServerConfig>) => {
        received = servers;
        mkdirSync(join(cwd, "config"), { recursive: true });
        writeFileSync(join(cwd, "config", "mcp.json"), "{}\n", "utf8");
        return { targetId: "x-headers-host", configPath: "config/mcp.json", servers: ["docs"] };
      },
    });

    const previous = process.env[ENV_NAME];
    process.env[ENV_NAME] = SECRET;
    try {
      await expect(
        runInstall({
          cwd,
          frozen: false,
          forcedTarget: "x-headers-host",
          forceTarget: "x-headers-host",
          integrationRegistry: registry as IntegrationRegistry,
          registry: registry as IntegrationRegistry,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        }),
      ).resolves.toMatchObject({ ok: true });
    } finally {
      if (previous === undefined) delete process.env[ENV_NAME];
      else process.env[ENV_NAME] = previous;
    }

    const list = Array.isArray(received) ? received : Object.values(received ?? {});
    expect(list).toHaveLength(1);
    expect(list[0]?.headers).toEqual({
      Authorization: `Bearer ${SECRET}`,
      "X-Static": "literal",
    });

    const lock = readFileSync(join(cwd, "bapm.lock.yaml"), "utf8");
    expect(lock).toContain("docs");
    expect(lock).toContain(`Bearer \${${ENV_NAME}}`);
    expect(lock).not.toContain(SECRET);
  });
});
