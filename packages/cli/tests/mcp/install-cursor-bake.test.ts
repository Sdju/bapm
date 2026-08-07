/**
 * Cursor install bakes MCP env placeholders before mcp.json write
 * (promoted from mcp-env-bake-time).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync } from "node:fs";
import {
  createTempProject,
  expectKnownFlags,
  mcpJsonPath,
  readMcpJsonRaw,
  readMcpServers,
  runInProject,
  writeDirectMcpEnvProject,
  type TempProject,
} from "./helpers.ts";

describe("CLI Cursor install MCP env bake", () => {
  let project: TempProject | undefined;
  const prevEnv: Record<string, string | undefined> = {};

  function setEnv(key: string, value: string | undefined): void {
    if (!(key in prevEnv)) prevEnv[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  afterEach(() => {
    for (const [key, value] of Object.entries(prevEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
      delete prevEnv[key];
    }
    project?.cleanup();
    project = undefined;
  });

  test("install --target cursor bakes ${API_TOKEN} into mcp.json literal", async () => {
    project = createTempProject();
    const secret = "cursor-bake-literal-token-9f3a";
    setEnv("API_TOKEN", secret);
    writeDirectMcpEnvProject(project.cwd, {
      envYaml: `        API_TOKEN: "\${API_TOKEN}"\n`,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);
    expect(result).toBe(0);

    const servers = readMcpServers(project.cwd);
    expect(servers).toHaveProperty("bake-stdio-server");
    const entry = servers["bake-stdio-server"] as { env?: Record<string, string> };
    expect(entry.env?.API_TOKEN).toBe(secret);
    expect(entry.env?.API_TOKEN).not.toBe("${API_TOKEN}");
    expect(readMcpJsonRaw(project.cwd)).not.toContain("${API_TOKEN}");
  });

  test("${env:VAR} and legacy <VAR> bake on Cursor install", async () => {
    project = createTempProject();
    setEnv("MY_TOKEN", "env-syntax-token");
    setEnv("ANGLE_TOKEN", "angle-syntax-token");
    writeDirectMcpEnvProject(project.cwd, {
      serverName: "multi-syntax-server",
      envYaml: `        FROM_ENV: "\${env:MY_TOKEN}"
        FROM_ANGLE: "<ANGLE_TOKEN>"
`,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);
    expect(result).toBe(0);

    const entry = readMcpServers(project.cwd)["multi-syntax-server"] as {
      env?: Record<string, string>;
    };
    expect(entry.env?.FROM_ENV).toBe("env-syntax-token");
    expect(entry.env?.FROM_ANGLE).toBe("angle-syntax-token");
  });

  test("plain env without placeholders still writes", async () => {
    project = createTempProject();
    writeDirectMcpEnvProject(project.cwd, {
      serverName: "plain-env-server",
      envYaml: `        FOO: "bar"\n`,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);
    expect(result).toBe(0);

    const entry = readMcpServers(project.cwd)["plain-env-server"] as {
      env?: Record<string, string>;
    };
    expect(entry.env?.FOO).toBe("bar");
  });

  test("unresolved ${MISSING_SECRET} aborts before placeholder mcp.json write", async () => {
    project = createTempProject();
    setEnv("MISSING_SECRET", undefined);
    writeDirectMcpEnvProject(project.cwd, {
      serverName: "missing-secret-server",
      envYaml: `        SECRET: "\${MISSING_SECRET}"\n`,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/MISSING_SECRET/);

    const raw = readMcpJsonRaw(project.cwd);
    if (raw !== undefined) {
      expect(raw).not.toContain("${MISSING_SECRET}");
    }
    // Prefer no durable write at all for this failed install.
    const servers = readMcpServers(project.cwd);
    const entry = servers["missing-secret-server"] as { env?: Record<string, string> } | undefined;
    if (entry?.env) {
      expect(entry.env.SECRET).not.toBe("${MISSING_SECRET}");
    }
  });

  test("baked config stores literals, not Cursor runtime placeholders", async () => {
    project = createTempProject();
    const secret = "no-runtime-placeholder-token";
    setEnv("API_TOKEN", secret);
    writeDirectMcpEnvProject(project.cwd, {
      envYaml: `        API_TOKEN: "\${API_TOKEN}"\n`,
    });

    const { result } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expect(result).toBe(0);
    expect(existsSync(mcpJsonPath(project.cwd))).toBe(true);
    const entry = readMcpServers(project.cwd)["bake-stdio-server"] as {
      env?: Record<string, string>;
    };
    expect(entry.env?.API_TOKEN).toBe(secret);
    expect(JSON.stringify(entry.env)).not.toMatch(/\$\{API_TOKEN\}|\$\{env:API_TOKEN\}/);
  });
});
