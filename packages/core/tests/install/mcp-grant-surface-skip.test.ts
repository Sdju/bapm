/**
 * Install MCP grant surface is not all-or-nothing:
 * - explicit project/user/org deny stays fatal;
 * - a mentioned-but-unapproved package stays fatal;
 * - an unmentioned package is skipped with `MCP_NOT_APPROVED` (warn);
 * - `--trust-transitive-mcp` without a surface still deploys dependency MCP.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createIntegrationRegistry } from "@b-apm/integration-api";
import { createCursorIntegration } from "@b-apm/integration-cursor";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { runInstall } from "../../src/index.ts";
import { createTempProject, type TempProject } from "./ux-helpers.ts";

type Diagnostic = Record<string, unknown>;

const DEP_MCP = `dependencies:
  apm: []
  mcp:
    - name: dep-server
      registry: false
      transport: stdio
      command: echo
      args: ["--ok"]
`;

function writeDepMcpProject(cwd: string, grants = ""): void {
  mkdirSync(join(cwd, ".cursor"), { recursive: true });
  mkdirSync(join(cwd, "mcp-dep"), { recursive: true });
  writeFileSync(
    join(cwd, "bapm.yml"),
    `name: surface-skip
version: 0.0.1
target: cursor
${grants}dependencies:
  apm:
    - path: ./mcp-dep
`,
    "utf8",
  );
  writeFileSync(
    join(cwd, "mcp-dep", "apm.yml"),
    `name: mcp-dep
version: 0.0.1
${DEP_MCP}`,
    "utf8",
  );
}

function createRegistry() {
  const registry = createIntegrationRegistry();
  registry.register(createCursorIntegration());
  return registry;
}

async function install(
  cwd: string,
  extra: { trustTransitiveMcp?: boolean; configDir?: string } = {},
): Promise<unknown> {
  const registry = createRegistry();
  return runInstall({
    cwd,
    frozen: false,
    integrationRegistry: registry,
    registry,
    configDir: extra.configDir ?? join(cwd, ".bapm-user"),
    ...(extra.trustTransitiveMcp !== undefined
      ? { trustTransitiveMcp: extra.trustTransitiveMcp }
      : {}),
  });
}

function readMcpServers(cwd: string): Record<string, unknown> {
  const path = join(cwd, ".cursor", "mcp.json");
  if (!existsSync(path)) return {};
  const raw = JSON.parse(readFileSync(path, "utf8")) as { mcpServers?: Record<string, unknown> };
  return raw.mcpServers ?? {};
}

function diagnosticsOf(result: unknown): Diagnostic[] {
  if (!result || typeof result !== "object") return [];
  const diagnostics = (result as { diagnostics?: unknown }).diagnostics;
  if (!Array.isArray(diagnostics)) return [];
  return diagnostics.filter(
    (item): item is Diagnostic => Boolean(item) && typeof item === "object",
  );
}

function diagnosticsByCode(result: unknown, code: string): Diagnostic[] {
  return diagnosticsOf(result).filter((item) => item.code === code);
}

async function expectFatalInstall(
  cwd: string,
  extra: { trustTransitiveMcp?: boolean; configDir?: string } = {},
): Promise<void> {
  let error: unknown;
  try {
    await install(cwd, extra);
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(Error);
  const message = error instanceof Error ? error.message : String(error);
  expect(message).toMatch(/MCP withheld/i);
  expect(message).toMatch(/mcp-dep/);
}

describe("install MCP grant surface skip semantics", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("unrelated allow + unmentioned dep MCP → install succeeds, server skipped, warn emitted", async () => {
    project = createTempProject();
    writeDepMcpProject(
      project.cwd,
      `executables:
  allow:
    acme/other:
      mcp: true
`,
    );

    const result = await install(project.cwd);

    expect(result).toMatchObject({ ok: true });
    expect(readMcpServers(project.cwd)).not.toHaveProperty("dep-server");
    const warnings = diagnosticsByCode(result, "MCP_NOT_APPROVED");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      code: "MCP_NOT_APPROVED",
      warn: true,
      packageName: "mcp-dep",
      skip: true,
    });
    expect(String(warnings[0]?.message)).toMatch(/mcp-dep/);
    expect(String(warnings[0]?.message)).toMatch(/bapm approve mcp-dep/);
    expect(String(warnings[0]?.message)).toMatch(/executables\.allow\.mcp-dep\.mcp: true/);
    expect(diagnosticsByCode(result, "MCP_TRUST_WITHHOLD")).toEqual([]);
  });

  test("empty executables.allow does not fail install", async () => {
    project = createTempProject();
    writeDepMcpProject(project.cwd, "executables:\n  allow: {}\n");

    const result = await install(project.cwd);

    expect(result).toMatchObject({ ok: true });
    expect(readMcpServers(project.cwd)).not.toHaveProperty("dep-server");
    expect(diagnosticsByCode(result, "MCP_NOT_APPROVED")).toHaveLength(1);
    expect(diagnosticsByCode(result, "MCP_TRUST_WITHHOLD")).toEqual([]);
  });

  test("explicit project deny stays fatal", async () => {
    project = createTempProject();
    writeDepMcpProject(
      project.cwd,
      `executables:
  deny:
    mcp-dep:
      mcp: true
`,
    );

    await expectFatalInstall(project.cwd);
    expect(readMcpServers(project.cwd)).not.toHaveProperty("dep-server");
  });

  test("explicit user deny stays fatal", async () => {
    project = createTempProject();
    writeDepMcpProject(project.cwd);
    const configDir = join(project.cwd, ".bapm-user");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      `${JSON.stringify({ executables: { deny: { "mcp-dep": { mcp: true } } } }, null, 2)}\n`,
      "utf8",
    );

    await expectFatalInstall(project.cwd, { configDir });
    expect(readMcpServers(project.cwd)).not.toHaveProperty("dep-server");
  });

  test.each([
    ["mcp: false", `executables:\n  allow:\n    mcp-dep:\n      mcp: false\n`],
    ["another executable type only", `executables:\n  allow:\n    mcp-dep:\n      bin: true\n`],
  ])("mentioned-but-not-approved (%s) stays fatal", async (_label, grants) => {
    project = createTempProject();
    writeDepMcpProject(project.cwd, grants);

    await expectFatalInstall(project.cwd);
    expect(readMcpServers(project.cwd)).not.toHaveProperty("dep-server");
  });

  test("org executables.deny stays fatal without a project surface", async () => {
    project = createTempProject();
    writeDepMcpProject(project.cwd);
    writeFileSync(
      join(project.cwd, "bapm-policy.yml"),
      `name: org-deny-mcp\nenforcement: warn\nexecutables:\n  deny:\n    - mcp-dep\n`,
      "utf8",
    );

    await expectFatalInstall(project.cwd, { trustTransitiveMcp: true });
    expect(readMcpServers(project.cwd)).not.toHaveProperty("dep-server");
  });

  test("org deny_all stays fatal and is mentioned for every package", async () => {
    project = createTempProject();
    writeDepMcpProject(project.cwd, "executables:\n  allow:\n    acme/other:\n      mcp: true\n");
    writeFileSync(
      join(project.cwd, "bapm-policy.yml"),
      `name: org-deny-all-mcp\nenforcement: warn\nexecutables:\n  deny_all: true\n`,
      "utf8",
    );

    await expectFatalInstall(project.cwd);
    expect(readMcpServers(project.cwd)).not.toHaveProperty("dep-server");
  });

  test("--trust-transitive-mcp still deploys dependency MCP without a surface", async () => {
    project = createTempProject();
    writeDepMcpProject(project.cwd);

    const result = await install(project.cwd, { trustTransitiveMcp: true });

    expect(result).toMatchObject({ ok: true });
    expect(readMcpServers(project.cwd)).toHaveProperty("dep-server");
    expect(diagnosticsByCode(result, "MCP_NOT_APPROVED")).toEqual([]);
  });
});
