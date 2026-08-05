/**
 * Install --only apm|mcp skip sides (install-pipeline / cursor-mcp-deploy).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  hasModulesContent,
  installWithSpy,
  writeMcpLeafProject,
  type TempProject,
} from "./ux-helpers.ts";

describe("install only-mode", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("only apm skips configureMcp; package materialize may still run", async () => {
    project = createTempProject();
    writeMcpLeafProject(project.cwd, "p7a-only-apm");

    const { result, spy } = await installWithSpy(project.cwd, {
      only: "apm",
      forcedTarget: "cursor",
      forceTarget: "cursor",
    });

    expect(result).toMatchObject({ ok: true });
    expect(spy.configureMcpCalls).toBe(0);
    expect(existsSync(join(project.cwd, ".cursor", "mcp.json"))).toBe(false);
    expect(spy.materializeCalls).toBeGreaterThan(0);
  });

  test("only mcp skips APM modules materialize; configureMcp may still run", async () => {
    project = createTempProject();
    writeMcpLeafProject(project.cwd, "p7a-only-mcp");

    const { result, spy } = await installWithSpy(project.cwd, {
      only: "mcp",
      forcedTarget: "cursor",
      forceTarget: "cursor",
    });

    expect(result).toMatchObject({ ok: true });
    expect(hasModulesContent(project.cwd)).toBe(false);
    expect(spy.configureMcpCalls).toBeGreaterThan(0);
  });
});
