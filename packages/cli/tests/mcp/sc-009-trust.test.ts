/**
 * M9 MUST: sc-009 fail-closed executable trust for dependency MCP.
 * Specs: executable-mcp-trust. Checklist D §8–9.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectKnownFlags,
  readMcpServers,
  runInProject,
  writeDepMcpProject,
  type TempProject,
} from "./helpers.ts";

const WITHHOLD =
  /withhold|unapproved|not approved|executables|allowExecutables|denied|trust|mcp.*(block|deny|refus)/i;

describe("CLI M9 sc-009 executable trust for MCP", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("grant surface present + dep MCP unapproved → no mcpServers entry; fail-closed signal", async () => {
    project = createTempProject();
    writeDepMcpProject(project.cwd, { approveDep: false, withSkill: true });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);

    const servers = readMcpServers(project.cwd);
    expect(servers).not.toHaveProperty("test-stdio-server");

    // Fail-closed: non-zero OR explicit withhold diagnostic (silent success is not enough).
    const failClosed = result !== 0 || WITHHOLD.test(combined);
    expect(failClosed).toBe(true);
  });

  test("approved dep MCP writes under .cursor/mcp.json", async () => {
    project = createTempProject();
    writeDepMcpProject(project.cwd, { approveDep: true });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(readMcpServers(project.cwd)).toHaveProperty("test-stdio-server");
  });

  test("allowExecutables alias grants same approval semantics", async () => {
    project = createTempProject();
    writeDepMcpProject(project.cwd, { approveDep: true, aliasAllowExecutables: true });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(readMcpServers(project.cwd)).toHaveProperty("test-stdio-server");
  });

  test("skills still materialize when MCP withheld under sc-009", async () => {
    project = createTempProject();
    writeDepMcpProject(project.cwd, { approveDep: false, withSkill: true });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);

    expect(readMcpServers(project.cwd)).not.toHaveProperty("test-stdio-server");
    // Gate must be visible; silent ignore of MCP is not sc-009.
    expect(result !== 0 || WITHHOLD.test(combined)).toBe(true);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(true);
  });
});
