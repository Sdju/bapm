/**
 * Cursor install keeps APM `${VAR}` references as native `${env:VAR}`
 * placeholders (no secrets in .cursor/mcp.json) and only resolves bapm
 * `{bake:NAME}` directives at install time.
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

describe("CLI Cursor install MCP env translate/bake", () => {
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

  test("install --target cursor keeps ${API_TOKEN} as ${env:API_TOKEN} (no literal)", async () => {
    project = createTempProject();
    const secret = "cursor-literal-token-9f3a";
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
    expect(entry.env?.API_TOKEN).toBe("${env:API_TOKEN}");
    expect(readMcpJsonRaw(project.cwd)).not.toContain(secret);
  });

  test("${env:VAR} and legacy <VAR> become Cursor-native ${env:VAR}", async () => {
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
    expect(entry.env?.FROM_ENV).toBe("${env:MY_TOKEN}");
    expect(entry.env?.FROM_ANGLE).toBe("${env:ANGLE_TOKEN}");
    expect(readMcpJsonRaw(project.cwd)).not.toContain("env-syntax-token");
    expect(readMcpJsonRaw(project.cwd)).not.toContain("angle-syntax-token");
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

  test("unset ${MISSING_SECRET} remains a runtime placeholder instead of aborting", async () => {
    project = createTempProject();
    setEnv("MISSING_SECRET", undefined);
    writeDirectMcpEnvProject(project.cwd, {
      serverName: "missing-secret-server",
      envYaml: `        SECRET: "\${MISSING_SECRET}"\n`,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(combined).not.toMatch(/MISSING_SECRET/);

    const entry = readMcpServers(project.cwd)["missing-secret-server"] as {
      env?: Record<string, string>;
    };
    expect(entry.env?.SECRET).toBe("${env:MISSING_SECRET}");
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

  test("manifest env satisfies {bake:PLUGIN_TOKEN} when process env unset", async () => {
    project = createTempProject();
    setEnv("PLUGIN_TOKEN", undefined);
    writeDirectMcpEnvProject(project.cwd, {
      manifestEnvYaml: `  PLUGIN_TOKEN: "from-yml"\n`,
      envYaml: `        TOKEN: "{bake:PLUGIN_TOKEN}"\n`,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);
    expect(result).toBe(0);

    const entry = readMcpServers(project.cwd)["bake-stdio-server"] as {
      env?: Record<string, string>;
    };
    expect(entry.env?.TOKEN).toBe("from-yml");
    expect(readMcpJsonRaw(project.cwd)).not.toContain("{bake:PLUGIN_TOKEN}");
  });

  test("manifest env is not baked into a Cursor runtime placeholder", async () => {
    project = createTempProject();
    setEnv("PLUGIN_TOKEN", undefined);
    writeDirectMcpEnvProject(project.cwd, {
      serverName: "apm-fill-server",
      manifestEnvYaml: `  PLUGIN_TOKEN: "yml-apm-fill"\n`,
      envYaml: `        TOKEN: "\${PLUGIN_TOKEN}"\n`,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);
    expect(result).toBe(0);

    const entry = readMcpServers(project.cwd)["apm-fill-server"] as {
      env?: Record<string, string>;
    };
    expect(entry.env?.TOKEN).toBe("${env:PLUGIN_TOKEN}");
    expect(readMcpJsonRaw(project.cwd)).not.toContain("yml-apm-fill");
    expect(existsSync(mcpJsonPath(project.cwd))).toBe(true);
  });

  test("{bake:} prefers process env over manifest env on Cursor install", async () => {
    project = createTempProject();
    setEnv("API_TOKEN", "from-process");
    writeDirectMcpEnvProject(project.cwd, {
      serverName: "process-wins-server",
      manifestEnvYaml: `  API_TOKEN: "from-yml"\n`,
      envYaml: `        TOKEN: "{bake:API_TOKEN}"\n`,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);
    expect(result).toBe(0);

    const entry = readMcpServers(project.cwd)["process-wins-server"] as {
      env?: Record<string, string>;
    };
    expect(entry.env?.TOKEN).toBe("from-process");
  });

  test("missing {bake:} in process and manifest aborts before unresolved mcp.json write", async () => {
    project = createTempProject();
    setEnv("MISSING_SECRET", undefined);
    writeDirectMcpEnvProject(project.cwd, {
      serverName: "missing-both-server",
      manifestEnvYaml: `  OTHER: "present"\n`,
      envYaml: `        SECRET: "{bake:MISSING_SECRET}"\n`,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/MISSING_SECRET/);

    const raw = readMcpJsonRaw(project.cwd);
    if (raw !== undefined) {
      expect(raw).not.toContain("{bake:MISSING_SECRET}");
    }
    const entry = readMcpServers(project.cwd)["missing-both-server"] as
      | { env?: Record<string, string> }
      | undefined;
    if (entry?.env) {
      expect(entry.env.SECRET).not.toBe("{bake:MISSING_SECRET}");
    }
  });
});
