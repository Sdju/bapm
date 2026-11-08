/**
 * M9 MUST: sc-009 executable trust for dependency MCP.
 * Specs: executable-mcp-trust. Checklist D §8–9.
 *
 * One project/user grant must not make every unrelated dependency MCP package
 * fatal: unmentioned packages are skipped with `MCP_NOT_APPROVED`. Explicit
 * deny (project/user/org) and mentioned-but-unapproved entries stay fatal.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectKnownFlags,
  readMcpServers,
  runInProject,
  writeDepMcpProject,
  type TempProject,
} from "./helpers.ts";

const SKIP_MESSAGE = /MCP_NOT_APPROVED|not approved|bapm approve mcp-dep/i;
const FATAL_MESSAGE =
  /withhold|unapproved|denied|executables|allowExecutables|trust|mcp.*(block|deny|refus)/i;

describe("CLI M9 sc-009 executable trust for MCP", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("unrelated allow + unmentioned dep MCP → install succeeds, server skipped with warning", async () => {
    project = createTempProject();
    writeDepMcpProject(project.cwd, { unrelatedAllow: true, withSkill: true });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);

    expect(result).toBe(0);
    expect(readMcpServers(project.cwd)).not.toHaveProperty("test-stdio-server");
    expect(combined).toMatch(SKIP_MESSAGE);
    expect(combined).toMatch(/MCP_NOT_APPROVED|warning/i);
    // Non-executable primitives still materialize.
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(true);
  });

  test("explicit project deny → install fails; server not deployed", async () => {
    project = createTempProject();
    writeDepMcpProject(project.cwd, { denyDep: true });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);

    expect(result).not.toBe(0);
    expect(combined).toMatch(FATAL_MESSAGE);
    expect(readMcpServers(project.cwd)).not.toHaveProperty("test-stdio-server");
  });

  test("mentioned-but-not-approved dep (mcp: false) → install fails", async () => {
    project = createTempProject();
    writeDepMcpProject(project.cwd, { mentionedUnapproved: true });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);

    expect(result).not.toBe(0);
    expect(combined).toMatch(FATAL_MESSAGE);
    expect(readMcpServers(project.cwd)).not.toHaveProperty("test-stdio-server");
  });

  test("org executables.deny still fails even when package is otherwise unmentioned", async () => {
    project = createTempProject();
    writeDepMcpProject(project.cwd, { unrelatedAllow: true });
    writeFileSync(
      join(project.cwd, "bapm-policy.yml"),
      `name: org-deny-mcp\nenforcement: warn\nexecutables:\n  deny:\n    - mcp-dep\n`,
      "utf8",
    );

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownFlags(combined);

    expect(result).not.toBe(0);
    expect(combined).toMatch(FATAL_MESSAGE);
    expect(combined).toMatch(/org|deny|mcp-dep/i);
    expect(readMcpServers(project.cwd)).not.toHaveProperty("test-stdio-server");
  });

  test("--trust-transitive-mcp still deploys dependency MCP without a grant surface", async () => {
    project = createTempProject();
    writeDepMcpProject(project.cwd, { noGrants: true });

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--target",
      "cursor",
      "--trust-transitive-mcp",
    ]);
    expectKnownFlags(combined);

    expect(result).toBe(0);
    expect(readMcpServers(project.cwd)).toHaveProperty("test-stdio-server");
    expect(combined).not.toMatch(SKIP_MESSAGE);
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
});
