/**
 * Acceptance (RED): Cursor install wires effective manifest.env into MCP bake.
 * OpenSpec change: manifest-env-bake / mcp-env-bake
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

describe("manifest-env-bake CLI Cursor install", () => {
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

  test("manifest env fills ${PLUGIN_TOKEN} on Cursor install when process unset", async () => {
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
    expect(entry.env?.TOKEN).toBe("yml-apm-fill");
    expect(existsSync(mcpJsonPath(project.cwd))).toBe(true);
  });

  test("process env wins over manifest env on Cursor install", async () => {
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

  test("missing in process and manifest aborts before unresolved mcp.json write", async () => {
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
