/**
 * Baked MCP env values reach the host config but never the lockfile.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IntegrationRegistry } from "@b-apm/integration-api";
import { runInstall } from "../../src/index.ts";
import {
  createFakePorts,
  createTempProject,
  getCreateIntegrationRegistry,
  getRegisterIntegration,
  importIntegrationApi,
  writeText,
  type TempProject,
} from "./ux-helpers.ts";

const SECRET = "secret-token-7f3a";
const BAKE_SECRET = "bake-value-91c2";

describe("MCP lock inventory keeps placeholders", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("lock records authored env, host config receives baked values", async () => {
    project = createTempProject();
    const cwd = project.cwd;
    mkdirSync(join(cwd, "leaf"), { recursive: true });
    writeFileSync(
      join(cwd, "bapm.yml"),
      `name: no-secrets
version: 0.0.1
env:
  BAKE_ME: ${BAKE_SECRET}
dependencies:
  apm:
    - path: ./leaf
  mcp:
    - name: tokened
      registry: false
      transport: stdio
      command: echo
      env:
        API_TOKEN: "\${API_TOKEN}"
        KEY: "{bake:BAKE_ME}"
`,
      "utf8",
    );
    writeFileSync(join(cwd, "leaf", "apm.yml"), "name: leaf\nversion: 0.0.1\n", "utf8");
    writeText(cwd, "leaf/.apm/skills/hello/SKILL.md", "---\nname: hello\n---\n# Hello\n");

    let received: unknown;
    const ports = createFakePorts();
    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    getRegisterIntegration(
      api,
      registry,
    )({
      id: "x-secret-host",
      deployRoots: ["config"],
      detect: () => true,
      materialize: async () => ({ deployedFiles: [] }),
      configureMcp: async (servers: unknown) => {
        received = servers;
        mkdirSync(join(cwd, "config"), { recursive: true });
        writeFileSync(join(cwd, "config", "mcp.json"), "{}\n", "utf8");
        return { targetId: "x-secret-host", configPath: "config/mcp.json", servers: ["tokened"] };
      },
    });

    const previous = process.env.API_TOKEN;
    process.env.API_TOKEN = SECRET;
    try {
      await expect(
        runInstall({
          cwd,
          frozen: false,
          forcedTarget: "x-secret-host",
          forceTarget: "x-secret-host",
          integrationRegistry: registry as IntegrationRegistry,
          registry: registry as IntegrationRegistry,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        }),
      ).resolves.toMatchObject({ ok: true });
    } finally {
      if (previous === undefined) delete process.env.API_TOKEN;
      else process.env.API_TOKEN = previous;
    }

    expect(JSON.stringify(received)).toContain(SECRET);

    const lock = readFileSync(join(cwd, "bapm.lock.yaml"), "utf8");
    expect(lock).toContain("tokened");
    expect(lock).not.toContain(SECRET);
    expect(lock).not.toContain(BAKE_SECRET);
    expect(lock).toContain("${API_TOKEN}");
    expect(lock).toContain("{bake:BAKE_ME}");
  });

  test("non-frozen install with no MCP declaration scrubs stale baked inventory", async () => {
    project = createTempProject();
    const cwd = project.cwd;
    writeFileSync(join(cwd, "bapm.yml"), "name: no-mcp-now\nversion: 0.0.1\n", "utf8");
    writeFileSync(join(cwd, "bapm.lock.yaml"), staleMcpLock(), "utf8");

    const ports = createFakePorts();
    const registry = await singleTargetRegistry();
    await expect(
      runInstall({
        cwd,
        frozen: false,
        integrationRegistry: registry,
        registry,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      }),
    ).resolves.toMatchObject({ ok: true });

    const lock = readFileSync(join(cwd, "bapm.lock.yaml"), "utf8");
    expect(lock).not.toContain(SECRET);
    expect(lock).not.toContain("tokened");
    expect(lock).not.toContain("mcp_servers");
    expect(lock).not.toContain("mcp_configs");
    expect(lock).not.toContain("mcp_target_servers");
    expect(lock).not.toContain("mcp_config_provenance");
    // Unrelated extension bags are not collateral damage.
    expect(lock).toContain("x_custom_inventory");
    expect(lock).toContain("keep-me");
  });

  test("frozen install leaves stale baked inventory untouched", async () => {
    project = createTempProject();
    const cwd = project.cwd;
    writeFileSync(join(cwd, "bapm.yml"), "name: frozen-no-mcp\nversion: 0.0.1\n", "utf8");
    const seeded = staleMcpLock();
    writeFileSync(join(cwd, "bapm.lock.yaml"), seeded, "utf8");

    const ports = createFakePorts();
    const registry = await singleTargetRegistry();
    await expect(
      runInstall({
        cwd,
        frozen: true,
        integrationRegistry: registry,
        registry,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      }),
    ).resolves.toMatchObject({ ok: true });

    const lock = readFileSync(join(cwd, "bapm.lock.yaml"), "utf8");
    expect(lock).toBe(seeded);
    expect(lock).toContain(SECRET);
    expect(lock).toContain("tokened");
  });

  test("all-withheld MCP still scrubs stale baked inventory before failing closed", async () => {
    project = createTempProject();
    const cwd = project.cwd;
    mkdirSync(join(cwd, "leaf"), { recursive: true });
    writeFileSync(
      join(cwd, "bapm.yml"),
      `name: withheld-mcp
version: 0.0.1
executables:
  allow: {}
dependencies:
  apm:
    - path: ./leaf
`,
      "utf8",
    );
    writeFileSync(
      join(cwd, "leaf", "apm.yml"),
      `name: leaf
version: 0.0.1
dependencies:
  mcp:
    - name: tokened
      registry: false
      transport: stdio
      command: echo
      env:
        API_TOKEN: "\${API_TOKEN}"
`,
      "utf8",
    );
    writeFileSync(join(cwd, "bapm.lock.yaml"), staleMcpLock(), "utf8");

    const ports = createFakePorts();
    const registry = await singleTargetRegistry();
    await expect(
      runInstall({
        cwd,
        frozen: false,
        integrationRegistry: registry,
        registry,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      }),
    ).rejects.toThrow(/MCP withheld/i);

    const lock = readFileSync(join(cwd, "bapm.lock.yaml"), "utf8");
    expect(lock).not.toContain(SECRET);
    expect(lock).not.toContain("tokened");
    expect(lock).not.toContain("mcp_");
    expect(lock).toContain("x_custom_inventory");
  });

  test("plain install preserves dependency-owned inventory when transitive trust is off", async () => {
    project = createTempProject();
    const cwd = project.cwd;
    mkdirSync(join(cwd, "leaf"), { recursive: true });
    writeFileSync(
      join(cwd, "bapm.yml"),
      `name: root-keep
version: 0.0.1
dependencies:
  apm:
    - path: ./leaf
`,
      "utf8",
    );
    writeFileSync(
      join(cwd, "leaf", "apm.yml"),
      `name: leaf
version: 0.0.1
dependencies:
  mcp:
    - name: dep-tool
      registry: false
      transport: stdio
      command: echo
`,
      "utf8",
    );
    writeFileSync(join(cwd, "bapm.lock.yaml"), dependencyInventoryLock(), "utf8");

    const ports = createFakePorts();
    const registry = await singleTargetRegistry();
    await expect(
      runInstall({
        cwd,
        frozen: false,
        integrationRegistry: registry,
        registry,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      }),
    ).resolves.toMatchObject({ ok: true });

    const lock = readFileSync(join(cwd, "bapm.lock.yaml"), "utf8");
    expect(lock).toContain("dep-tool");
    expect(lock).toContain("package: leaf");
    expect(lock).toContain("mcp_config_provenance");
    expect(lock).toContain("mcp_target_servers");
    // A dependency that disappeared from the resolved node set is stale.
    expect(lock).not.toContain("stale-dep");
  });

  test("server named toString is never resurrected from Object.prototype", async () => {
    project = createTempProject();
    const cwd = project.cwd;
    writeFileSync(
      join(cwd, "bapm.yml"),
      `name: proto-safe
version: 0.0.1
dependencies:
  mcp:
    - name: keep-server
      registry: false
      transport: stdio
      command: echo
`,
      "utf8",
    );
    writeFileSync(
      join(cwd, "bapm.lock.yaml"),
      `lockfile_version: "1"
dependencies: []
mcp_servers:
  toString:
    name: toString
    package: proto-safe
    command: echo
    env:
      API_TOKEN: "${SECRET}"
`,
      "utf8",
    );

    const ports = createFakePorts();
    const registry = await singleTargetRegistry();
    await expect(
      runInstall({
        cwd,
        frozen: false,
        integrationRegistry: registry,
        registry,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      }),
    ).resolves.toMatchObject({ ok: true });

    const lock = readFileSync(join(cwd, "bapm.lock.yaml"), "utf8");
    expect(lock).not.toContain("toString");
    expect(lock).not.toContain(SECRET);
    expect(lock).toContain("keep-server");
  });
});

function staleMcpLock(): string {
  return `lockfile_version: "1"
dependencies: []
mcp_servers:
  tokened:
    name: tokened
    transport: stdio
    command: echo
    env:
      API_TOKEN: "${SECRET}"
mcp_config_provenance:
  tokened:
    package: root
    path: config/mcp.json
mcp_configs:
  x-scrub-host:
    path: .cursor/mcp.json
    servers: [tokened]
mcp_target_servers:
  x-scrub-host: [tokened]
x_custom_inventory:
  keep-me: true
`;
}

function dependencyInventoryLock(): string {
  return `lockfile_version: "1"
dependencies: []
mcp_servers:
  dep-tool:
    name: dep-tool
    package: leaf
    transport: stdio
    command: echo
  stale-dep:
    name: stale-dep
    package: gone-dep
    transport: stdio
    command: echo
mcp_config_provenance:
  dep-tool:
    package: leaf
    path: config/mcp.json
  stale-dep:
    package: gone-dep
    path: config/mcp.json
mcp_target_servers:
  x-scrub-host:
    - dep-tool
    - stale-dep
x_custom_inventory:
  keep-me: true
`;
}

async function singleTargetRegistry(): Promise<IntegrationRegistry> {
  const api = await importIntegrationApi();
  const registry = getCreateIntegrationRegistry(api)();
  getRegisterIntegration(
    api,
    registry,
  )({
    id: "x-scrub-host",
    deployRoots: [".agents/skills"],
    detect: () => true,
    materialize: async () => ({ targetId: "x-scrub-host", deployedFiles: [] }),
  });
  return registry as IntegrationRegistry;
}
