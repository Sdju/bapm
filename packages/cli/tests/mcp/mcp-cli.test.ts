/**
 * `bapm mcp` — read-only MCP inventory inspection (list/show/search).
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  fingerprintProject,
  runInProject,
  writeText,
  type TempProject,
} from "../install/helpers.ts";

type McpJson = {
  lockfile: string | null;
  manifest: string | null;
  servers: Array<{
    name: string;
    package: string | null;
    origin: string;
    transport: string | null;
    command: string | null;
    args: string[] | null;
    url: string | null;
    env: Record<string, string> | null;
    headers: Record<string, string> | null;
    targets: Array<{ targetId: string; path: string | null }>;
    configPath: string | null;
    source: string;
    approval: string | null;
    withheld: boolean;
    omitted: boolean;
  }>;
};

type Project = TempProject & { home: string; cleanup: () => void };

function createProject(): Project {
  const project = createTempProject("bapm-mcp-cli-");
  const home = mkdtempSync(join(tmpdir(), "bapm-mcp-home-"));
  return {
    cwd: project.cwd,
    home,
    cleanup: () => {
      project.cleanup();
      rmSync(home, { recursive: true, force: true });
    },
  };
}

const MANIFEST = `name: demo-root
version: 0.0.1
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
  dep-http:
    name: dep-http
    package: leaf
    type: http
    url: https://example.test/mcp
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

function parseJson(stdout: string[]): McpJson {
  return JSON.parse(stdout.join("\n")) as McpJson;
}

describe("CLI mcp", () => {
  let project: Project | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("empty lock: list --json returns an empty stable shape", async () => {
    project = createProject();
    writeText(project.cwd, "bapm.lock.yaml", 'lockfile_version: "1"\ndependencies: []\n');

    const { result, stdout, stderr } = await runInProject(project.cwd, ["mcp", "list", "--json"], {
      HOME: project.home,
    });
    expect(result).toBe(0);
    expect(stderr.join("\n")).toBe("");
    const json = parseJson(stdout);
    expect(json.servers).toEqual([]);
    expect(json.lockfile).toContain("bapm.lock.yaml");
    expect(json.manifest).toBeNull();
  });

  test("manifest-only: list shows direct dependencies.mcp without target configs", async () => {
    project = createProject();
    writeText(project.cwd, "bapm.yml", MANIFEST);

    const { result, stdout } = await runInProject(project.cwd, ["mcp", "list", "--json"], {
      HOME: project.home,
    });
    expect(result).toBe(0);
    const [server] = parseJson(stdout).servers;
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
  });

  test("lock inventory with multiple targets and provenance", async () => {
    project = createProject();
    writeText(project.cwd, "bapm.yml", MANIFEST);
    writeText(project.cwd, "bapm.lock.yaml", MULTI_TARGET_LOCK);

    const { result, stdout } = await runInProject(project.cwd, ["mcp", "list", "--json"], {
      HOME: project.home,
    });
    expect(result).toBe(0);
    const json = parseJson(stdout);
    const dep = json.servers.find((server) => server.name === "dep-http");
    expect(dep).toMatchObject({
      package: "leaf",
      origin: "dependency",
      transport: "http",
      url: "https://example.test/mcp",
      configPath: ".mcp.json",
      source: "lock",
    });
    expect(dep?.targets).toEqual([
      { targetId: "claude", path: ".mcp.json" },
      { targetId: "cursor", path: ".cursor/mcp.json" },
    ]);
  });

  test("list --json shape has stable summary keys", async () => {
    project = createProject();
    writeText(project.cwd, "bapm.yml", MANIFEST);
    writeText(project.cwd, "bapm.lock.yaml", MULTI_TARGET_LOCK);

    const { result, stdout } = await runInProject(project.cwd, ["mcp", "list", "--json"], {
      HOME: project.home,
    });
    expect(result).toBe(0);
    const json = parseJson(stdout);
    expect(Object.keys(json).sort()).toEqual(["lockfile", "manifest", "servers"]);
    expect(Object.keys(json.servers[0]!).sort()).toEqual([
      "approval",
      "args",
      "command",
      "configPath",
      "env",
      "headers",
      "name",
      "omitted",
      "origin",
      "package",
      "source",
      "targets",
      "transport",
      "url",
      "withheld",
    ]);
  });

  test("show prints details and rejects unknown names", async () => {
    project = createProject();
    writeText(project.cwd, "bapm.yml", MANIFEST);
    writeText(project.cwd, "bapm.lock.yaml", MULTI_TARGET_LOCK);

    const known = await runInProject(project.cwd, ["mcp", "show", "manifest-only", "--local"], {
      HOME: project.home,
    });
    expect(known.result).toBe(0);
    expect(known.combined).toContain("manifest-only");
    expect(known.combined).toContain("declaration:");

    const unknown = await runInProject(project.cwd, ["mcp", "show", "nope", "--local"], {
      HOME: project.home,
    });
    expect(unknown.result).toBe(1);
    expect(unknown.stderr.join("\n")).toContain('MCP server "nope" not found');
    expect(unknown.stderr.join("\n")).toContain("Available:");
  });

  test("show --json on an unknown name returns a JSON error on stderr", async () => {
    project = createProject();
    writeText(project.cwd, "bapm.lock.yaml", 'lockfile_version: "1"\ndependencies: []\n');

    const { result, stderr } = await runInProject(
      project.cwd,
      ["mcp", "show", "missing", "--local", "--json"],
      { HOME: project.home },
    );
    expect(result).toBe(1);
    const error = JSON.parse(stderr.join("\n")) as {
      error: string;
      name: string;
      available: string[];
    };
    expect(error).toEqual({ error: "unknown_server", name: "missing", available: [] });
  });

  test("search is an offline filter over the local inventory", async () => {
    project = createProject();
    writeText(project.cwd, "bapm.yml", MANIFEST);
    writeText(project.cwd, "bapm.lock.yaml", MULTI_TARGET_LOCK);

    const hit = await runInProject(project.cwd, ["mcp", "search", "leaf", "--local", "--json"], {
      HOME: project.home,
    });
    expect(hit.result).toBe(0);
    const json = JSON.parse(hit.stdout.join("\n")) as {
      query: string;
      servers: Array<{ name: string }>;
    };
    expect(json.query).toBe("leaf");
    expect(json.servers.map((server) => server.name)).toEqual(["dep-http"]);

    const miss = await runInProject(project.cwd, ["mcp", "search", "absent", "--local"], {
      HOME: project.home,
    });
    expect(miss.result).toBe(0);
    expect(miss.combined).toContain("no MCP servers matching");
  });

  test("--help lists subcommands and read-only scope", async () => {
    project = createProject();
    const { result, combined } = await runInProject(project.cwd, ["mcp", "--help"], {
      HOME: project.home,
    });
    expect(result).toBe(0);
    expect(combined).toContain("bapm mcp list");
    expect(combined).toContain("bapm mcp show <name>");
    expect(combined).toContain("bapm mcp search <query>");
    expect(combined).toContain("bapm mcp install <name>");
    expect(combined).toMatch(/--local/i);
  });

  test("help mcp topic delegates to command help", async () => {
    project = createProject();
    const { result, combined } = await runInProject(project.cwd, ["help", "mcp"], {
      HOME: project.home,
    });
    expect(result).toBe(0);
    expect(combined).toContain("bapm mcp list");
  });

  test("mcp install requires a server name", async () => {
    project = createProject();
    const { result, combined } = await runInProject(project.cwd, ["mcp", "install"], {
      HOME: project.home,
    });
    expect(result).toBe(1);
    expect(combined).toContain("mcp install requires a server name");
  });

  test("inspection writes nothing to the project", async () => {
    project = createProject();
    writeText(project.cwd, "bapm.yml", MANIFEST);
    writeText(project.cwd, "bapm.lock.yaml", MULTI_TARGET_LOCK);
    const before = fingerprintProject(project.cwd);

    const list = await runInProject(project.cwd, ["mcp", "list"], { HOME: project.home });
    const show = await runInProject(project.cwd, ["mcp", "show", "dep-http", "--local"], {
      HOME: project.home,
    });
    const search = await runInProject(project.cwd, ["mcp", "search", "leaf", "--local"], {
      HOME: project.home,
    });
    expect([list.result, show.result, search.result]).toEqual([0, 0, 0]);
    expect(fingerprintProject(project.cwd)).toBe(before);
  });
});
