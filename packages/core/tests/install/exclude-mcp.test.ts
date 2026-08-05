/**
 * --exclude cursor skips configureMcp; unknown exclude fail-closed.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  createFakePorts,
  createTempProject,
  fingerprintProject,
  getCreateRegistry,
  getRegisterTarget,
  getRunInstall,
  importTargetApi,
  installWithSpy,
  writeLeafProject,
  writeMcpLeafProject,
  type TempProject,
} from "./ux-helpers.ts";

describe("install exclude cursor skips MCP configure", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("exclude cursor skips configureMcp while materialize may still run", async () => {
    project = createTempProject();
    writeMcpLeafProject(project.cwd, "exclude-cursor");

    const { result, spy } = await installWithSpy(project.cwd, {
      excludeTargets: ["cursor"],
      exclude: ["cursor"],
      forcedTarget: "cursor",
      forceTarget: "cursor",
    });

    expect(result).toMatchObject({ ok: true });
    expect(spy.configureMcpCalls).toBe(0);
    expect(existsSync(join(project.cwd, ".cursor", "mcp.json"))).toBe(false);
    // Exclude filters MCP configure, not the whole install / materialize.
    expect(spy.materializeCalls).toBeGreaterThan(0);
  });

  test("unknown exclude id rejected without mutation", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "exclude-unknown");
    const before = fingerprintProject(project.cwd);

    const runInstall = getRunInstall();
    const ports = createFakePorts();
    const api = await importTargetApi();
    const registry = getCreateRegistry(api)();
    getRegisterTarget(api, registry)({
      id: "cursor",
      deployRoots: [".agents/skills", ".cursor"],
      detect: () => true,
      materialize: async () => ({ deployedFiles: [] }),
    });

    await expect(
      runInstall({
        cwd: project.cwd,
        excludeTargets: ["not-a-runtime"],
        exclude: ["not-a-runtime"],
        targetRegistry: registry,
        registry,
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      }),
    ).rejects.toThrow(/exclude|unknown|unrecognized|not-a-runtime/i);

    expect(fingerprintProject(project.cwd)).toBe(before);
  });
});
