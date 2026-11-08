import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  listMcpInventory,
  searchMcpInventory,
  showMcpServer,
  type McpServerSummary,
} from "../../src/index.ts";

type Project = { cwd: string; configRoot: string; cleanup: () => void };

function createProject(): Project {
  const root = mkdtempSync(join(tmpdir(), "bapm-mcp-inventory-"));
  return {
    cwd: root,
    configRoot: join(root, "home", ".bapm"),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function write(cwd: string, name: string, contents: string): void {
  writeFileSync(join(cwd, name), contents, "utf8");
}

const EMPTY_LOCK = `lockfile_version: "1"
dependencies: []
`;

const MANIFEST = `name: demo-root
version: 0.0.1
executables:
  allow:
    leaf:
      mcp: true
dependencies:
  mcp:
    - name: manifest-only
      command: echo
      args: ["hi"]
`;

const MULTI_TARGET_LOCK = `lockfile_version: "1"
dependencies: []
mcp_servers:
  root-stdio:
    name: root-stdio
    package: demo-root
    transport: stdio
    command: echo
    args: ["hello"]
  dep-http:
    name: dep-http
    package: leaf
    type: http
    url: https://example.test/mcp
    headers:
      Authorization: "Bearer \${env:TOKEN}"
mcp_configs:
  cursor:
    path: .cursor/mcp.json
    servers: [root-stdio, dep-http]
  claude:
    path: .mcp.json
    servers: [dep-http]
mcp_target_servers:
  cursor: [root-stdio, dep-http]
  claude: [dep-http]
mcp_config_provenance:
  root-stdio:
    package: demo-root
    path: .cursor/mcp.json
  dep-http:
    package: leaf
    path: .mcp.json
`;

function byName(servers: McpServerSummary[], name: string): McpServerSummary {
  const server = servers.find((entry) => entry.name === name);
  if (!server) throw new Error(`missing server ${name}: ${servers.map((s) => s.name).join(",")}`);
  return server;
}

describe("core MCP inventory", () => {
  let project: Project | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("empty lock and no manifest → empty inventory, lock path retained", () => {
    project = createProject();
    write(project.cwd, "bapm.lock.yaml", EMPTY_LOCK);

    const result = listMcpInventory({ cwd: project.cwd, configRoot: project.configRoot });
    expect(result.servers).toEqual([]);
    expect(result.manifestPath).toBeNull();
    expect(result.lockPath).toContain("bapm.lock.yaml");
  });

  test("manifest-only direct dependencies.mcp is listed without target configs", () => {
    project = createProject();
    write(project.cwd, "bapm.yml", MANIFEST);

    const result = listMcpInventory({ cwd: project.cwd, configRoot: project.configRoot });
    const server = byName(result.servers, "manifest-only");
    expect(server).toMatchObject({
      name: "manifest-only",
      package: "demo-root",
      origin: "direct",
      transport: "stdio",
      command: "echo",
      args: ["hi"],
      targets: [],
      configPath: null,
      source: "manifest",
      approval: "direct",
      withheld: false,
      omitted: false,
    });
    expect(result.lockPath).toBeNull();
  });

  test("lock inventory joins mcp_servers, target configs, provenance and grants", () => {
    project = createProject();
    write(project.cwd, "bapm.yml", MANIFEST);
    write(project.cwd, "bapm.lock.yaml", MULTI_TARGET_LOCK);

    const result = listMcpInventory({ cwd: project.cwd, configRoot: project.configRoot });
    expect(result.servers.map((server) => server.name)).toEqual([
      "dep-http",
      "manifest-only",
      "root-stdio",
    ]);

    const dep = byName(result.servers, "dep-http");
    expect(dep).toMatchObject({
      package: "leaf",
      origin: "dependency",
      transport: "http",
      url: "https://example.test/mcp",
      headers: { Authorization: "Bearer ${env:TOKEN}" },
      configPath: ".mcp.json",
      source: "lock",
      approval: "allow",
      withheld: false,
    });
    expect(dep.targets).toEqual([
      { targetId: "claude", path: ".mcp.json" },
      { targetId: "cursor", path: ".cursor/mcp.json" },
    ]);

    const root = byName(result.servers, "root-stdio");
    expect(root).toMatchObject({
      package: "demo-root",
      origin: "direct",
      transport: "stdio",
      args: ["hello"],
      configPath: ".cursor/mcp.json",
      approval: "direct",
    });
    expect(root.targets).toEqual([{ targetId: "cursor", path: ".cursor/mcp.json" }]);
  });

  test("show returns declaration + lock entry; unknown name fails with available list", () => {
    project = createProject();
    write(project.cwd, "bapm.yml", MANIFEST);
    write(project.cwd, "bapm.lock.yaml", MULTI_TARGET_LOCK);

    const shown = showMcpServer({
      cwd: project.cwd,
      configRoot: project.configRoot,
      name: "dep-http",
    });
    expect(shown.ok).toBe(true);
    if (!shown.ok) return;
    expect(shown.server.lockEntry).toMatchObject({
      package: "leaf",
      url: "https://example.test/mcp",
    });
    expect(shown.server.declaration).toBeNull();
    expect(shown.server.lockPath).toContain("bapm.lock.yaml");

    const missing = showMcpServer({
      cwd: project.cwd,
      configRoot: project.configRoot,
      name: "nope",
    });
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.available).toEqual(["dep-http", "manifest-only", "root-stdio"]);
    expect(missing.error).toContain("not found");
  });

  test("search filters the local inventory by name/package/target", () => {
    project = createProject();
    write(project.cwd, "bapm.yml", MANIFEST);
    write(project.cwd, "bapm.lock.yaml", MULTI_TARGET_LOCK);

    const byPackage = searchMcpInventory({
      cwd: project.cwd,
      configRoot: project.configRoot,
      query: "leaf",
    });
    expect(byPackage.query).toBe("leaf");
    expect(byPackage.servers.map((server) => server.name)).toEqual(["dep-http"]);

    const byTarget = searchMcpInventory({
      cwd: project.cwd,
      configRoot: project.configRoot,
      query: "claude",
    });
    expect(byTarget.servers.map((server) => server.name)).toEqual(["dep-http"]);

    const none = searchMcpInventory({
      cwd: project.cwd,
      configRoot: project.configRoot,
      query: "does-not-exist",
    });
    expect(none.servers).toEqual([]);
  });

  test("mcp_omissions marks a server omitted/withheld when the lock carries it", () => {
    project = createProject();
    write(project.cwd, "bapm.yml", MANIFEST);
    write(
      project.cwd,
      "bapm.lock.yaml",
      `${MULTI_TARGET_LOCK}mcp_omissions:
  dep-http:
    reason: unapproved
`,
    );

    const result = listMcpInventory({ cwd: project.cwd, configRoot: project.configRoot });
    const dep = byName(result.servers, "dep-http");
    expect(dep.omitted).toBe(true);
    expect(dep.withheld).toBe(true);
    expect(dep.approval).toBe("withhold");
  });
});
