/**
 * Acceptance (RED): Cursor install bakes `{bake:NAME}` before mcp.json write.
 * OpenSpec change: mcp-bake-directive
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

describe("mcp-bake-directive CLI Cursor install bake", () => {
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

  test("install --target cursor bakes {bake:API_TOKEN} into mcp.json literal", async () => {
    project = createTempProject();
    const secret = "cursor-bake-directive-token-9f3a";
    setEnv("API_TOKEN", secret);
    writeDirectMcpEnvProject(project.cwd, {
      envYaml: `        API_TOKEN: "{bake:API_TOKEN}"\n`,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);
    expect(result).toBe(0);

    const servers = readMcpServers(project.cwd);
    expect(servers).toHaveProperty("bake-stdio-server");
    const entry = servers["bake-stdio-server"] as { env?: Record<string, string> };
    expect(entry.env?.API_TOKEN).toBe(secret);
    expect(entry.env?.API_TOKEN).not.toBe("{bake:API_TOKEN}");
    expect(readMcpJsonRaw(project.cwd)).not.toContain("{bake:API_TOKEN}");
  });

  test("{bake:env:VAR} bakes on Cursor install", async () => {
    project = createTempProject();
    setEnv("MY_TOKEN", "bake-env-syntax-token");
    writeDirectMcpEnvProject(project.cwd, {
      serverName: "bake-env-syntax-server",
      envYaml: `        FROM_BAKE_ENV: "{bake:env:MY_TOKEN}"\n`,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);
    expect(result).toBe(0);

    const entry = readMcpServers(project.cwd)["bake-env-syntax-server"] as {
      env?: Record<string, string>;
    };
    expect(entry.env?.FROM_BAKE_ENV).toBe("bake-env-syntax-token");
  });

  test("unresolved {bake:MISSING} aborts before unresolved token mcp.json write", async () => {
    project = createTempProject();
    setEnv("MISSING", undefined);
    writeDirectMcpEnvProject(project.cwd, {
      serverName: "missing-bake-server",
      envYaml: `        SECRET: "{bake:MISSING}"\n`,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/MISSING/);

    const raw = readMcpJsonRaw(project.cwd);
    if (raw !== undefined) {
      expect(raw).not.toContain("{bake:MISSING}");
    }
    const servers = readMcpServers(project.cwd);
    const entry = servers["missing-bake-server"] as { env?: Record<string, string> } | undefined;
    if (entry?.env) {
      expect(entry.env.SECRET).not.toBe("{bake:MISSING}");
    }
  });

  test("APM ${API_TOKEN} still bakes on Cursor install (unchanged)", async () => {
    project = createTempProject();
    const secret = "apm-form-still-bakes-token";
    setEnv("API_TOKEN", secret);
    writeDirectMcpEnvProject(project.cwd, {
      serverName: "apm-parity-server",
      envYaml: `        API_TOKEN: "\${API_TOKEN}"\n`,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(existsSync(mcpJsonPath(project.cwd))).toBe(true);
    const entry = readMcpServers(project.cwd)["apm-parity-server"] as {
      env?: Record<string, string>;
    };
    expect(entry.env?.API_TOKEN).toBe(secret);
    expect(JSON.stringify(entry.env)).not.toMatch(/\$\{API_TOKEN\}/);
  });
});
