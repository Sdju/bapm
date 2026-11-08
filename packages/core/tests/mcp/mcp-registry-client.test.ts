/**
 * MCP registry client — injectable transport, stable search/show shapes, URL
 * precedence, fail-closed errors, and secret-safe diagnostics. No network.
 */
import { describe, expect, test } from "vite-plus/test";
import {
  createMcpRegistryClient,
  resolveMcpRegistryUrl,
  resolveMcpServerFromRegistry,
  redactMcpRegistryDetails,
  McpRegistryError,
  type RegistryHttpRequest,
  type RegistryHttpResponse,
  type McpRegistryTransport,
  type McpRegistryServerDetails,
} from "../../src/index.ts";

const utf8 = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

function fakeTransport(
  handler: (request: RegistryHttpRequest) => RegistryHttpResponse | Promise<RegistryHttpResponse>,
): { transport: McpRegistryTransport; requests: RegistryHttpRequest[] } {
  const requests: RegistryHttpRequest[] = [];
  return {
    transport: {
      fetch(request) {
        requests.push(request);
        return handler(request);
      },
    },
    requests,
  };
}

const SEARCH_BODY = {
  servers: [
    {
      server: {
        name: "io.github.acme/tool",
        description: "Acme tools",
        version: "1.2.3",
        packages: [
          {
            registryType: "npm",
            identifier: "@acme/tool",
            version: "1.2.3",
            runtimeHint: "npx",
          },
        ],
        remotes: [{ type: "streamable-http", url: "https://acme.test/mcp" }],
      },
    },
  ],
};

const DETAIL_BODY = {
  server: {
    name: "io.github.acme/tool",
    description: "Acme tools",
    version: "1.2.3",
    repository: { url: "https://github.com/acme/tool" },
    websiteUrl: "https://acme.test",
    packages: [
      {
        registryType: "npm",
        identifier: "@acme/tool",
        version: "1.2.3",
        runtimeHint: "npx",
        runtimeArguments: [{ type: "positional", value: "--stdio" }],
        packageArguments: [{ value_hint: "--verbose" }],
        environmentVariables: [
          { name: "ACME_TOKEN", isRequired: true, isSecret: true },
          { name: "ACME_MODE", default: "safe" },
        ],
      },
    ],
    remotes: [
      {
        type: "streamable-http",
        url: "https://acme.test/mcp",
        headers: [{ name: "Authorization", value: "Bearer registry-value" }],
      },
    ],
  },
};

describe("MCP registry client", () => {
  test("search uses /v0/servers and returns stable summaries", async () => {
    const fake = fakeTransport(() => ({ status: 200, headers: {}, body: utf8(SEARCH_BODY) }));
    const client = createMcpRegistryClient({
      baseUrl: "https://registry.test",
      transport: fake.transport,
    });

    const results = await client.searchServers("tool", { limit: 5 });

    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]!.method).toBe("GET");
    expect(fake.requests[0]!.url).toBe("https://registry.test/v0/servers?search=tool&limit=5");
    expect(fake.requests[0]!.headers).toEqual({});
    expect(results).toEqual([
      {
        name: "io.github.acme/tool",
        description: "Acme tools",
        version: "1.2.3",
        transports: ["stdio", "streamable-http"],
        packages: [
          {
            registryType: "npm",
            identifier: "@acme/tool",
            version: "1.2.3",
            runtimeHint: "npx",
          },
        ],
      },
    ]);
  });

  test("show URL-encodes the server name and parses details", async () => {
    const fake = fakeTransport(() => ({ status: 200, headers: {}, body: utf8(DETAIL_BODY) }));
    const client = createMcpRegistryClient({
      baseUrl: "https://registry.test/",
      transport: fake.transport,
    });

    const details = await client.getServer("io.github.acme/tool");

    expect(fake.requests[0]!.url).toBe(
      "https://registry.test/v0/servers/io.github.acme%2Ftool/versions/latest",
    );
    expect(details).toMatchObject({
      name: "io.github.acme/tool",
      description: "Acme tools",
      version: "1.2.3",
      repositoryUrl: "https://github.com/acme/tool",
      websiteUrl: "https://acme.test",
      transports: ["stdio", "streamable-http"],
    });
    expect(details.packageDetails[0]).toMatchObject({
      registryType: "npm",
      identifier: "@acme/tool",
      runtimeArguments: ["--stdio"],
      packageArguments: ["--verbose"],
    });
    expect(details.packageDetails[0]!.environmentVariables).toEqual([
      { name: "ACME_TOKEN", required: true, secret: true },
      { name: "ACME_MODE", required: false, secret: false, defaultValue: "safe" },
    ]);
  });

  test("show strips header values in public output", async () => {
    const fake = fakeTransport(() => ({ status: 200, headers: {}, body: utf8(DETAIL_BODY) }));
    const client = createMcpRegistryClient({
      baseUrl: "https://registry.test",
      transport: fake.transport,
    });
    const details = await client.getServer("io.github.acme/tool");
    const safe = redactMcpRegistryDetails(details);
    expect(safe.remotes).toEqual([
      { type: "streamable-http", url: "https://acme.test/mcp", headers: ["Authorization"] },
    ]);
    expect(JSON.stringify(safe)).not.toContain("registry-value");
  });

  test("empty search returns an empty list", async () => {
    const fake = fakeTransport(() => ({ status: 200, headers: {}, body: utf8({ servers: [] }) }));
    const client = createMcpRegistryClient({
      baseUrl: "https://registry.test",
      transport: fake.transport,
    });
    expect(await client.searchServers("absent")).toEqual([]);
    expect(fake.requests[0]!.url).toBe("https://registry.test/v0/servers?search=absent");
  });

  test("network failure fails closed without leaking the token", async () => {
    const fake = fakeTransport(() => {
      throw new Error("connect ECONNREFUSED");
    });
    const client = createMcpRegistryClient({
      baseUrl: "https://registry.test",
      transport: fake.transport,
      token: "super-secret-token",
    });
    let thrown: unknown;
    try {
      await client.searchServers("tool");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(McpRegistryError);
    expect((thrown as McpRegistryError).code).toBe("MCP_REGISTRY_HTTP");
    expect((thrown as Error).message).toContain("https://registry.test");
    expect((thrown as Error).message).not.toContain("super-secret-token");
    expect(fake.requests[0]!.headers).toEqual({ Authorization: "Bearer super-secret-token" });
  });

  test("401 names the token env but never echoes the token", async () => {
    const fake = fakeTransport(() => ({
      status: 401,
      headers: {},
      body: new TextEncoder().encode("denied"),
    }));
    const client = createMcpRegistryClient({
      baseUrl: "https://registry.test",
      transport: fake.transport,
      token: "super-secret-token",
    });
    let thrown: unknown;
    try {
      await client.getServer("io.github.acme/tool");
    } catch (error) {
      thrown = error;
    }
    expect((thrown as McpRegistryError).code).toBe("MCP_REGISTRY_AUTH");
    expect((thrown as Error).message).toContain("MCP_REGISTRY_TOKEN");
    expect((thrown as Error).message).not.toContain("super-secret-token");
  });

  test("URL precedence: explicit > env > config > default", () => {
    expect(
      resolveMcpRegistryUrl({
        explicit: "https://flag.test",
        configuredUrl: "https://config.test",
        env: { MCP_REGISTRY_URL: "https://env.test" },
      }),
    ).toEqual({ url: "https://flag.test", source: "explicit" });
    expect(
      resolveMcpRegistryUrl({
        configuredUrl: "https://config.test",
        env: { MCP_REGISTRY_URL: "https://env.test" },
      }),
    ).toEqual({ url: "https://env.test", source: "env" });
    expect(
      resolveMcpRegistryUrl({
        configuredUrl: "https://config.test",
        env: {},
      }),
    ).toEqual({ url: "https://config.test", source: "config" });
    expect(resolveMcpRegistryUrl({ env: {} })).toEqual({
      url: "https://api.mcp.github.com",
      source: "default",
    });
  });

  test("invalid and insecure URLs fail closed", () => {
    expect(() => resolveMcpRegistryUrl({ explicit: "not-a-url" })).toThrow(McpRegistryError);
    expect(() => resolveMcpRegistryUrl({ explicit: "ftp://registry.test" })).toThrow(/scheme/i);
    expect(() =>
      resolveMcpRegistryUrl({ env: { MCP_REGISTRY_URL: "http://registry.test" } }),
    ).toThrow(/http/i);
    expect(
      resolveMcpRegistryUrl({
        env: { MCP_REGISTRY_URL: "http://registry.test", MCP_REGISTRY_ALLOW_HTTP: "1" },
      }),
    ).toEqual({ url: "http://registry.test", source: "env" });
    expect(resolveMcpRegistryUrl({ explicit: "http://localhost:8787/registry/" })).toEqual({
      url: "http://localhost:8787/registry",
      source: "explicit",
    });
  });

  test("credentials in --registry are rejected without echoing the password", () => {
    let thrown: unknown;
    try {
      resolveMcpRegistryUrl({ explicit: "https://user:password@registry.test" });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(McpRegistryError);
    expect((thrown as Error).message).toContain("embedded credentials");
    expect((thrown as Error).message).not.toContain("password");
  });

  test("registry detail converts to npm, remote, and unsupported shapes", () => {
    const details = detailFromBody();
    const npm = resolveMcpServerFromRegistry(details);
    expect(npm.server).toMatchObject({
      name: "io.github.acme/tool",
      registry: false,
      transport: "stdio",
      command: "npx",
      args: ["-y", "--stdio", "@acme/tool", "--verbose"],
      env: { ACME_MODE: "safe" },
    });
    expect(npm.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "MCP_REGISTRY_ENV_REQUIRED",
    );

    const remoteOnly = resolveMcpServerFromRegistry({
      ...details,
      packageDetails: [],
    });
    expect(remoteOnly.server).toMatchObject({
      registry: false,
      transport: "streamable-http",
      url: "https://acme.test/mcp",
      headers: { Authorization: "Bearer registry-value" },
    });

    expect(() =>
      resolveMcpServerFromRegistry({ ...details, packageDetails: [], remotes: [] }),
    ).toThrow(/no installable package/i);
  });

  test("explicit remote transport prefers remotes over packages", () => {
    const details = detailFromBody();
    const resolved = resolveMcpServerFromRegistry(details, { transport: "http" });
    expect(resolved.server).toMatchObject({
      transport: "http",
      url: "https://acme.test/mcp",
    });
    expect(resolved.server.command).toBeUndefined();
  });
});

function detailFromBody(): McpRegistryServerDetails {
  return {
    name: "io.github.acme/tool",
    description: "Acme tools",
    version: "1.2.3",
    repositoryUrl: "https://github.com/acme/tool",
    websiteUrl: "https://acme.test",
    transports: ["stdio", "streamable-http"],
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
        runtimeArguments: ["--stdio"],
        packageArguments: ["--verbose"],
        environmentVariables: [
          { name: "ACME_TOKEN", required: true, secret: true },
          { name: "ACME_MODE", required: false, secret: false, defaultValue: "safe" },
        ],
      },
    ],
  };
}
