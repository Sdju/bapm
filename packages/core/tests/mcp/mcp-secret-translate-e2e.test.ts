/**
 * Cursor / OpenCode / Codex keep `${VAR}` references in host config instead of
 * baking secrets. `{bake:NAME}` still resolves (fail-closed); the lock always
 * records authored placeholders.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IntegrationRegistry } from "@b-apm/integration-api";
import { createCodexIntegration } from "@b-apm/integration-codex";
import { createCursorIntegration } from "@b-apm/integration-cursor";
import { createOpencodeIntegration } from "@b-apm/integration-opencode";
import { runInstall } from "../../src/index.ts";
import {
  createFakePorts,
  createTempProject,
  getCreateIntegrationRegistry,
  importIntegrationApi,
  type TempProject,
} from "../install/ux-helpers.ts";

const API_SECRET = "api-secret-never-on-disk";
const HEADER_SECRET = "header-secret-never-on-disk";
const BAKE_SECRET = "explicit-bake-value";

describe("MCP secret translate end-to-end", () => {
  let project: TempProject | undefined;
  const previous: Record<string, string | undefined> = {};

  function setEnv(key: string, value: string | undefined): void {
    if (!(key in previous)) previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
      delete previous[key];
    }
    project?.cleanup();
    project = undefined;
  });

  async function registryWith(
    target: ReturnType<typeof createCursorIntegration>,
  ): Promise<IntegrationRegistry> {
    const api = await importIntegrationApi();
    const registry = getCreateIntegrationRegistry(api)();
    registry.register(target);
    return registry as IntegrationRegistry;
  }

  async function installWith(target: ReturnType<typeof createCursorIntegration>): Promise<void> {
    const registry = await registryWith(target);
    const ports = createFakePorts();
    await expect(
      runInstall({
        cwd: project!.cwd,
        frozen: false,
        forcedTarget: target.id,
        forceTarget: target.id,
        integrationRegistry: registry,
        registry,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      }),
    ).resolves.toMatchObject({ ok: true });
  }

  function writeManifest(transport: "stdio" | "http"): void {
    const server =
      transport === "stdio"
        ? `      transport: stdio
      command: node
      args: ["server.mjs"]`
        : `      transport: http
      url: https://mcp.example.com/`;
    writeFileSync(
      join(project!.cwd, "bapm.yml"),
      `name: secret-translate
version: 0.0.1
env:
  BAKE_TOKEN: ${BAKE_SECRET}
dependencies:
  apm: []
  mcp:
    - name: token-server
      registry: false
${server}
      env:
        API_TOKEN: "\${API_TOKEN}"
        BAKED: "{bake:BAKE_TOKEN}"
      headers:
        Authorization: "Bearer \${HEADER_TOKEN}"
        X-Tenant: "\${env:TENANT_ID}"
        X-Static: literal
`,
      "utf8",
    );
  }

  test("Cursor writes ${env:VAR} placeholders, resolves only {bake:}, and lock keeps authored forms", async () => {
    project = createTempProject("bapm-cursor-secret-");
    mkdirSync(join(project!.cwd, ".cursor"), { recursive: true });
    setEnv("API_TOKEN", API_SECRET);
    setEnv("HEADER_TOKEN", HEADER_SECRET);
    writeManifest("http");

    await installWith(createCursorIntegration());

    const raw = readFileSync(join(project!.cwd, ".cursor", "mcp.json"), "utf8");
    const server = (
      JSON.parse(raw) as {
        mcpServers: Record<
          string,
          { env?: Record<string, string>; headers?: Record<string, string> }
        >;
      }
    ).mcpServers["token-server"]!;
    expect(server.env?.API_TOKEN).toBe("${env:API_TOKEN}");
    expect(server.env?.BAKED).toBe(BAKE_SECRET);
    expect(server.headers?.Authorization).toBe("Bearer ${env:HEADER_TOKEN}");
    expect(raw).not.toContain(API_SECRET);
    expect(raw).not.toContain(HEADER_SECRET);

    const lock = readFileSync(join(project!.cwd, "bapm.lock.yaml"), "utf8");
    expect(lock).toContain("${API_TOKEN}");
    expect(lock).toContain("{bake:BAKE_TOKEN}");
    expect(lock).toContain("Bearer ${HEADER_TOKEN}");
    expect(lock).not.toContain(API_SECRET);
    expect(lock).not.toContain(HEADER_SECRET);
    expect(lock).not.toContain(BAKE_SECRET);
  });

  test("OpenCode writes {env:VAR} placeholders and keeps secrets out of opencode.json", async () => {
    project = createTempProject("bapm-opencode-secret-");
    mkdirSync(join(project!.cwd, ".opencode"), { recursive: true });
    setEnv("API_TOKEN", API_SECRET);
    setEnv("HEADER_TOKEN", HEADER_SECRET);
    writeManifest("stdio");

    await installWith(createOpencodeIntegration());

    const raw = readFileSync(join(project!.cwd, "opencode.json"), "utf8");
    const server = (
      JSON.parse(raw) as {
        mcp: Record<string, { environment?: Record<string, string>; command?: unknown[] }>;
      }
    ).mcp["token-server"]!;
    expect(server.environment?.API_TOKEN).toBe("{env:API_TOKEN}");
    expect(server.environment?.BAKED).toBe(BAKE_SECRET);
    expect(server.command).toEqual(["node", "server.mjs"]);
    expect(raw).not.toContain(API_SECRET);
    expect(raw).not.toContain(HEADER_SECRET);

    const lock = readFileSync(join(project!.cwd, "bapm.lock.yaml"), "utf8");
    expect(lock).toContain("${API_TOKEN}");
    expect(lock).toContain("Bearer ${HEADER_TOKEN}");
    expect(lock).not.toContain(API_SECRET);
    expect(lock).not.toContain(HEADER_SECRET);
  });

  test("Codex maps header env references to native fields without baking", async () => {
    project = createTempProject("bapm-codex-secret-");
    mkdirSync(join(project!.cwd, ".codex"), { recursive: true });
    setEnv("API_TOKEN", API_SECRET);
    setEnv("HEADER_TOKEN", HEADER_SECRET);
    writeManifest("http");

    await installWith(createCodexIntegration());

    const raw = readFileSync(join(project!.cwd, ".codex", "config.toml"), "utf8");
    expect(raw).toContain('bearer_token_env_var = "HEADER_TOKEN"');
    expect(raw).toMatch(/env_http_headers/);
    expect(raw).toMatch(/X-Tenant\s*=\s*"TENANT_ID"/);
    expect(raw).toMatch(/X-Static\s*=\s*"literal"/);
    expect(raw).not.toContain(HEADER_SECRET);
    expect(raw).not.toContain("${HEADER_TOKEN}");
    expect(raw).not.toContain("Authorization");

    const lock = readFileSync(join(project!.cwd, "bapm.lock.yaml"), "utf8");
    expect(lock).toContain("Bearer ${HEADER_TOKEN}");
    expect(lock).not.toContain(HEADER_SECRET);
  });

  test("missing {bake:NAME} fails closed before host MCP config write", async () => {
    project = createTempProject("bapm-cursor-bake-missing-");
    mkdirSync(join(project!.cwd, ".cursor"), { recursive: true });
    setEnv("BAKE_MISSING", undefined);
    writeFileSync(
      join(project!.cwd, "bapm.yml"),
      `name: bake-missing
version: 0.0.1
dependencies:
  apm: []
  mcp:
    - name: needs-bake
      registry: false
      transport: stdio
      command: echo
      env:
        SECRET: "{bake:BAKE_MISSING}"
`,
      "utf8",
    );

    const registry = await registryWith(createCursorIntegration());
    const ports = createFakePorts();
    await expect(
      runInstall({
        cwd: project!.cwd,
        frozen: false,
        forcedTarget: "cursor",
        forceTarget: "cursor",
        integrationRegistry: registry,
        registry,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      }),
    ).rejects.toMatchObject({ code: "INSTALL_MCP_ENV_BAKE" });

    expect(existsSync(join(project!.cwd, ".cursor", "mcp.json"))).toBe(false);
  });
});
