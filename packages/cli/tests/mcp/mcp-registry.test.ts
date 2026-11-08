/**
 * `bapm mcp` registry search/show/install — injectable client, no network.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import type {
  McpRegistryClient,
  McpRegistryServerDetails,
  McpRegistrySource,
  McpRegistryTransport,
} from "@b-apm/core";
import { createMcp } from "../../src/modules/Mcp/index.ts";

type Project = { cwd: string; cleanup: () => void };

function createProject(): Project {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-mcp-registry-"));
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

async function withCapturedIo<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; stdout: string[]; stderr: string[] }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (msg?: unknown) => {
    stdout.push(String(msg));
  };
  console.error = (msg?: unknown) => {
    stderr.push(String(msg));
  };
  try {
    const result = await fn();
    return { result, stdout, stderr };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

function details(): McpRegistryServerDetails {
  return {
    name: "io.github.acme/tool",
    description: "Acme tools",
    version: "1.2.3",
    repositoryUrl: "https://github.com/acme/tool",
    websiteUrl: "https://acme.test",
    transports: ["stdio"],
    packages: [
      {
        registryType: "npm",
        identifier: "@acme/tool",
        version: "1.2.3",
        runtimeHint: "npx",
      },
    ],
    remotes: [
      {
        type: "streamable-http",
        url: "https://acme.test/mcp",
        headers: [{ name: "Authorization", value: "Bearer registry-value" }],
      },
    ],
    packageDetails: [
      {
        registryType: "npm",
        identifier: "@acme/tool",
        version: "1.2.3",
        runtimeHint: "npx",
        runtimeArguments: [],
        packageArguments: [],
        environmentVariables: [],
      },
    ],
  };
}

function fakeClient(
  behavior: {
    search?: () => Promise<McpRegistryServerDetails[]>;
    get?: () => Promise<McpRegistryServerDetails>;
  } = {},
): {
  factory: (resolution: { url: string; source: McpRegistrySource }) => McpRegistryClient;
  seen: Array<{ url: string; source: McpRegistrySource }>;
} {
  const seen: Array<{ url: string; source: McpRegistrySource }> = [];
  return {
    seen,
    factory(resolution) {
      seen.push(resolution);
      return {
        baseUrl: resolution.url,
        source: resolution.source,
        async searchServers() {
          const servers = await (behavior.search ?? (async () => [details()]))();
          return servers.map((server) => ({
            name: server.name,
            description: server.description,
            version: server.version,
            transports: server.transports,
            packages: server.packages,
          }));
        },
        async getServer() {
          return await (behavior.get ?? (async () => details()))();
        },
      };
    },
  };
}

function makeMcp(
  project: Project,
  options: {
    factory?: ReturnType<typeof fakeClient>["factory"];
    env?: Record<string, string | undefined>;
    configureAfterInstall?: (options: { cwd?: string }) => Promise<{
      ok: boolean;
      message?: string;
    }>;
  } = {},
) {
  return createMcp({
    name: "bapm",
    manifestFile: "bapm.yml",
    lockFile: "bapm.lock.yaml",
    ...(options.factory ? { mcpRegistryClientFactory: options.factory } : {}),
    ...(options.env ? { env: options.env } : {}),
    ...(options.configureAfterInstall
      ? { configureAfterInstall: options.configureAfterInstall }
      : {}),
  });
}

describe("CLI mcp registry", () => {
  let project: Project | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("search --json returns a stable registry shape", async () => {
    project = createProject();
    const fake = fakeClient();
    const api = makeMcp(project, { factory: fake.factory });

    const { result, stdout, stderr } = await withCapturedIo(() =>
      api.run({
        cwd: project!.cwd,
        args: ["search", "tool", "--registry", "https://registry.test", "--json"],
      }),
    );

    expect(result.exitCode).toBe(0);
    expect(stderr).toEqual([]);
    const json = JSON.parse(stdout.join("\n")) as {
      registry: string;
      source: string;
      query: string;
      servers: Array<{ name: string; transports: string[] }>;
    };
    expect(json.registry).toBe("https://registry.test");
    expect(json.query).toBe("tool");
    expect(json.servers[0]).toMatchObject({
      name: "io.github.acme/tool",
      transports: ["stdio"],
    });
    expect(fake.seen).toEqual([{ url: "https://registry.test", source: "explicit" }]);
  });

  test("search empty results succeed with a stable empty array", async () => {
    project = createProject();
    const fake = fakeClient({ search: async () => [] });
    const api = makeMcp(project, { factory: fake.factory });

    const { result, stdout } = await withCapturedIo(() =>
      api.run({ cwd: project!.cwd, args: ["search", "absent", "--json"] }),
    );

    expect(result.exitCode).toBe(0);
    const json = JSON.parse(stdout.join("\n")) as { servers: unknown[] };
    expect(json.servers).toEqual([]);
  });

  test("show --json redacts registry-authored header values", async () => {
    project = createProject();
    const fake = fakeClient();
    const api = makeMcp(project, { factory: fake.factory });

    const { result, stdout } = await withCapturedIo(() =>
      api.run({ cwd: project!.cwd, args: ["show", "io.github.acme/tool", "--json"] }),
    );

    expect(result.exitCode).toBe(0);
    const json = JSON.parse(stdout.join("\n")) as {
      server: { remotes: Array<{ headers: string[] }> };
    };
    expect(json.server.remotes[0]!.headers).toEqual(["Authorization"]);
    expect(stdout.join("\n")).not.toContain("registry-value");
  });

  test("explicit --registry wins over MCP_REGISTRY_URL", async () => {
    project = createProject();
    const fake = fakeClient();
    const api = makeMcp(project, {
      factory: fake.factory,
      env: { MCP_REGISTRY_URL: "https://env.test" },
    });

    const { result } = await withCapturedIo(() =>
      api.run({
        cwd: project!.cwd,
        args: ["search", "tool", "--registry", "https://flag.test", "--json"],
      }),
    );

    expect(result.exitCode).toBe(0);
    expect(fake.seen).toEqual([{ url: "https://flag.test", source: "explicit" }]);
  });

  test("MCP_REGISTRY_URL is used when --registry is absent", async () => {
    project = createProject();
    const fake = fakeClient();
    const api = makeMcp(project, {
      factory: fake.factory,
      env: { MCP_REGISTRY_URL: "https://env.test" },
    });

    const { result } = await withCapturedIo(() =>
      api.run({ cwd: project!.cwd, args: ["search", "tool", "--json"] }),
    );

    expect(result.exitCode).toBe(0);
    expect(fake.seen).toEqual([{ url: "https://env.test", source: "env" }]);
  });

  test("invalid --registry fails closed without echoing credentials", async () => {
    project = createProject();
    const fake = fakeClient();
    const api = makeMcp(project, { factory: fake.factory });

    const { result, stderr } = await withCapturedIo(() =>
      api.run({
        cwd: project!.cwd,
        args: ["show", "io.github.acme/tool", "--registry", "https://user:secret@registry.test"],
      }),
    );

    expect(result.exitCode).toBe(1);
    const text = stderr.join("\n");
    expect(text).toContain("embedded credentials");
    expect(text).not.toContain("secret");
    expect(fake.seen).toEqual([]);
  });

  test("network failure returns non-zero and a registry error", async () => {
    project = createProject();
    const fake = fakeClient({
      get: async () => {
        throw Object.assign(new Error("Could not reach MCP registry at https://registry.test"), {
          code: "MCP_REGISTRY_HTTP",
        });
      },
    });
    const api = makeMcp(project, { factory: fake.factory });

    const { result, stderr } = await withCapturedIo(() =>
      api.run({
        cwd: project!.cwd,
        args: ["show", "io.github.acme/tool", "--registry", "https://registry.test", "--json"],
      }),
    );

    expect(result.exitCode).toBe(1);
    const json = JSON.parse(stderr.join("\n")) as { error: string; message: string };
    expect(json.error).toBe("MCP_REGISTRY_HTTP");
    expect(json.message).toContain("Could not reach MCP registry");
  });

  test("install --dry-run emits a manifest snippet and writes nothing", async () => {
    project = createProject();
    const manifest = `name: demo\nversion: 0.0.1\ndependencies:\n  mcp: []\n`;
    writeFileSync(join(project.cwd, "bapm.yml"), manifest, "utf8");
    const fake = fakeClient();
    const api = makeMcp(project, { factory: fake.factory });

    const { result, stdout } = await withCapturedIo(() =>
      api.run({
        cwd: project!.cwd,
        args: [
          "install",
          "io.github.acme/tool",
          "--registry",
          "https://registry.test",
          "--dry-run",
          "--json",
        ],
      }),
    );

    expect(result.exitCode).toBe(0);
    const json = JSON.parse(stdout.join("\n")) as {
      dryRun: boolean;
      manifest: { name: string; registry: boolean; command: string; args: string[] };
    };
    expect(json.dryRun).toBe(true);
    expect(json.manifest).toMatchObject({
      name: "io.github.acme/tool",
      registry: false,
      command: "npx",
      args: ["-y", "@acme/tool"],
    });
    expect(readFileSync(join(project.cwd, "bapm.yml"), "utf8")).toBe(manifest);
    expect(existsSync(join(project.cwd, "bapm.lock.yaml"))).toBe(false);
  });

  test("install adds the concrete entry and reuses the existing configure pass", async () => {
    project = createProject();
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: demo\nversion: 0.0.1\ndependencies:\n  mcp: []\n`,
      "utf8",
    );
    let configured = false;
    const fake = fakeClient();
    const api = makeMcp(project, {
      factory: fake.factory,
      configureAfterInstall: async () => {
        configured = true;
        return { ok: true };
      },
    });

    const { result, stdout } = await withCapturedIo(() =>
      api.run({
        cwd: project!.cwd,
        args: ["install", "io.github.acme/tool", "--registry", "https://registry.test", "--json"],
      }),
    );

    expect(result.exitCode).toBe(0);
    expect(configured).toBe(true);
    const json = JSON.parse(stdout.join("\n")) as {
      added: boolean;
      installed: boolean;
      manifest: { registry: boolean; command: string };
    };
    expect(json).toMatchObject({ added: true, installed: true });
    expect(json.manifest.registry).toBe(false);
    const written = readFileSync(join(project.cwd, "bapm.yml"), "utf8");
    expect(written).toContain("io.github.acme/tool");
    expect(written).toContain("command: npx");
    expect(written).toContain("registry: false");
  });

  test("--local keeps the offline inventory behavior", async () => {
    project = createProject();
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: demo\nversion: 0.0.1\ndependencies:\n  mcp:\n    - name: local-tool\n      command: echo\n`,
      "utf8",
    );
    const fake = fakeClient();
    const api = makeMcp(project, { factory: fake.factory });

    const { result, stdout } = await withCapturedIo(() =>
      api.run({ cwd: project!.cwd, args: ["search", "local", "--local", "--json"] }),
    );

    expect(result.exitCode).toBe(0);
    const json = JSON.parse(stdout.join("\n")) as { servers: Array<{ name: string }> };
    expect(json.servers.map((server) => server.name)).toEqual(["local-tool"]);
    expect(fake.seen).toEqual([]);
  });

  test("MCP_REGISTRY_TOKEN is never printed", async () => {
    project = createProject();
    const env: Record<string, string | undefined> = {
      MCP_REGISTRY_URL: "https://registry.test",
      MCP_REGISTRY_TOKEN: "secret-token-value",
    };
    const transport: McpRegistryTransport = {
      fetch() {
        return { status: 200, headers: {}, body: new TextEncoder().encode('{"servers":[]}') };
      },
    };
    const api = createMcp({
      name: "bapm",
      manifestFile: "bapm.yml",
      lockFile: "bapm.lock.yaml",
      env,
      mcpRegistryTransport: transport,
    });

    const { result, stdout, stderr } = await withCapturedIo(() =>
      api.run({ cwd: project!.cwd, args: ["search", "tool", "--json"] }),
    );

    expect(result.exitCode).toBe(0);
    expect([...stdout, ...stderr].join("\n")).not.toContain("secret-token-value");
  });
});
