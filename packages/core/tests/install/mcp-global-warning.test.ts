/**
 * Home-scoped MCP (Copilot/Windsurf) writes a user-global file shared by every
 * project. Install must surface that path and support an explicit opt-out.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runInstall } from "../../src/index.ts";
import type { IntegrationRegistry, McpServerConfig } from "@b-apm/integration-api";
import {
  createFakePorts,
  createTempProject,
  getCreateIntegrationRegistry,
  getRegisterIntegration,
  importIntegrationApi,
  type TempProject,
} from "./ux-helpers.ts";

type GlobalTarget = "copilot" | "windsurf";

function writeMcpProject(cwd: string, name: string, active: string[]): void {
  mkdirSync(join(cwd, "leaf"), { recursive: true });
  writeFileSync(
    join(cwd, "bapm.yml"),
    [
      `name: ${name}`,
      "version: 0.0.1",
      ...(active.length === 1
        ? ["active:", `  target: ${active[0]}`]
        : ["active:", "  target:", ...active.map((id) => `    - ${id}`)]),
      "dependencies:",
      "  apm:",
      "    - path: ./leaf",
      "  mcp:",
      "    - name: shared-server",
      "      registry: false",
      "      transport: stdio",
      "      command: echo",
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    join(cwd, "leaf", "apm.yml"),
    "name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n",
    "utf8",
  );
}

function registerMcpTarget(args: {
  register: ReturnType<typeof getRegisterIntegration>;
  cwd: string;
  id: string;
  scope: "project" | "home";
  calls: string[];
  configPath: string;
  repo?: string;
}): void {
  const { register, id, scope, calls, configPath, repo = ".agents" } = args;
  register({
    id,
    deployRoots: [repo],
    ...(scope === "home" ? { mcpScope: "home" as const } : {}),
    detect: () => false,
    materialize: async () => ({ targetId: id, deployedFiles: [] }),
    configureMcp: async (servers: McpServerConfig[] | Record<string, McpServerConfig>) => {
      calls.push(id);
      const destination = join(args.cwd, configPath);
      mkdirSync(join(destination, ".."), { recursive: true });
      const list = Array.isArray(servers) ? servers : Object.values(servers);
      writeFileSync(
        destination,
        `${JSON.stringify({ mcpServers: list.map((server) => server.name) }, null, 2)}\n`,
        "utf8",
      );
      return {
        targetId: id,
        configPath: destination,
        servers: list.map((server) => server.name),
      };
    },
  });
}

function diagnosticsFor(result: unknown, code: string): Array<Record<string, unknown>> {
  const diagnostics = (result as { diagnostics?: unknown[] } | undefined)?.diagnostics ?? [];
  return diagnostics.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === "object" && (item as Record<string, unknown>).code === code,
  );
}

describe("install warns about user-global MCP config", () => {
  let project: TempProject | undefined;
  let home: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    home?.cleanup();
    project = undefined;
    home = undefined;
  });

  for (const target of ["copilot", "windsurf"] as const satisfies GlobalTarget[]) {
    test(`${target} emits one warning with the home config path`, async () => {
      project = createTempProject(`bapm-global-mcp-${target}-`);
      home = createTempProject(`bapm-global-mcp-home-${target}-`);
      writeMcpProject(project.cwd, `global-${target}`, [target]);

      const calls: string[] = [];
      const ports = createFakePorts();
      const api = await importIntegrationApi();
      const registry = getCreateIntegrationRegistry(api)();
      registerMcpTarget({
        register: getRegisterIntegration(api, registry),
        cwd: home.cwd,
        id: target,
        scope: "home",
        calls,
        configPath: `${target}/mcp-config.json`,
      });

      const result = await runInstall({
        cwd: project.cwd,
        integrationRegistry: registry as IntegrationRegistry,
        registry: registry as IntegrationRegistry,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      });

      expect(result).toMatchObject({ ok: true });
      expect(calls).toEqual([target]);
      const warnings = diagnosticsFor(result, "MCP_GLOBAL_CONFIG_WARN");
      expect(warnings).toHaveLength(1);
      const warning = warnings[0]!;
      expect(warning.warn).toBe(true);
      expect(warning.target).toBe(target);
      expect(warning.path).toBe(join(home.cwd, target, "mcp-config.json"));
      expect(String(warning.message)).toContain(join(home.cwd, target, "mcp-config.json"));
      expect(String(warning.message)).toMatch(/shared across|shared by every project/i);
      expect(String(warning.message)).toContain(`--exclude ${target}`);
      expect(readFileSync(join(home.cwd, target, "mcp-config.json"), "utf8")).toContain(
        "shared-server",
      );
    });
  }

  test("--exclude copilot,windsurf suppresses configure and the warning", async () => {
    project = createTempProject("bapm-global-mcp-exclude-");
    home = createTempProject("bapm-global-mcp-exclude-home-");
    writeMcpProject(project.cwd, "global-exclude", ["copilot", "windsurf"]);

    const calls: string[] = [];
    const ports = createFakePorts();
    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    const register = getRegisterIntegration(api, registry);
    registerMcpTarget({
      register,
      cwd: home.cwd,
      id: "copilot",
      scope: "home",
      calls,
      configPath: "copilot/mcp-config.json",
    });
    registerMcpTarget({
      register,
      cwd: home.cwd,
      id: "windsurf",
      scope: "home",
      calls,
      configPath: "windsurf/mcp_config.json",
    });

    const result = await runInstall({
      cwd: project.cwd,
      exclude: ["copilot", "windsurf"],
      excludeTargets: ["copilot", "windsurf"],
      integrationRegistry: registry as IntegrationRegistry,
      registry: registry as IntegrationRegistry,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(result).toMatchObject({ ok: true });
    expect(calls).toEqual([]);
    expect(diagnosticsFor(result, "MCP_GLOBAL_CONFIG_WARN")).toHaveLength(0);
    expect(existsSync(join(home.cwd, "copilot", "mcp-config.json"))).toBe(false);
    expect(existsSync(join(home.cwd, "windsurf", "mcp_config.json"))).toBe(false);
  });

  test("project-scoped hosts do not emit the global MCP warning", async () => {
    project = createTempProject("bapm-global-mcp-project-");
    writeMcpProject(project.cwd, "global-project", ["cursor"]);

    const calls: string[] = [];
    const ports = createFakePorts();
    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    registerMcpTarget({
      register: getRegisterIntegration(api, registry),
      cwd: project.cwd,
      id: "cursor",
      scope: "project",
      calls,
      configPath: ".cursor/mcp.json",
      repo: ".cursor",
    });

    const result = await runInstall({
      cwd: project.cwd,
      integrationRegistry: registry as IntegrationRegistry,
      registry: registry as IntegrationRegistry,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(result).toMatchObject({ ok: true });
    expect(calls).toEqual(["cursor"]);
    expect(diagnosticsFor(result, "MCP_GLOBAL_CONFIG_WARN")).toHaveLength(0);
    expect(existsSync(join(project.cwd, ".cursor", "mcp.json"))).toBe(true);
  });

  test("BAPM_NO_GLOBAL_MCP=1 skips home-scoped configure without the warning", async () => {
    project = createTempProject("bapm-global-mcp-env-");
    home = createTempProject("bapm-global-mcp-env-home-");
    writeMcpProject(project.cwd, "global-env", ["windsurf"]);

    const calls: string[] = [];
    const ports = createFakePorts();
    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    registerMcpTarget({
      register: getRegisterIntegration(api, registry),
      cwd: home.cwd,
      id: "windsurf",
      scope: "home",
      calls,
      configPath: "windsurf/mcp_config.json",
    });

    const result = await runInstall({
      cwd: project.cwd,
      env: { BAPM_NO_GLOBAL_MCP: "1" },
      integrationRegistry: registry as IntegrationRegistry,
      registry: registry as IntegrationRegistry,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(result).toMatchObject({ ok: true });
    expect(calls).toEqual([]);
    expect(diagnosticsFor(result, "MCP_GLOBAL_CONFIG_WARN")).toHaveLength(0);
    expect(diagnosticsFor(result, "MCP_GLOBAL_CONFIG_SKIPPED")).toHaveLength(1);
    expect(existsSync(join(home.cwd, "windsurf", "mcp_config.json"))).toBe(false);
  });
});
