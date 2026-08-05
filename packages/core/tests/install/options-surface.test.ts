/**
 * Install options: parallelDownloads / verbose / MCP frozen sync default-off.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  installWithSpy,
  readInstallTypesSource,
  writeLeafProject,
  writeMcpLeafProject,
  type TempProject,
} from "./ux-helpers.ts";

describe("install options surface", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("RunInstallOptions includes dryRun, packageRefs/exclude alongside parallelDownloads + verbose", () => {
    const src = readInstallTypesSource();
    expect(src).toMatch(/\bparallelDownloads\??\s*:/);
    expect(src).toMatch(/\bverbose\??\s*:/);
    expect(src).toMatch(/\bpackageRefs\??\s*:/);
    expect(src).toMatch(/\bexcludeTargets\??\s*:|\bexclude\??\s*:/);
    expect(src).toMatch(/\bdryRun\??\s*:/);
  });

  test("verbose does not weaken frozen failure (missing lock)", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "verbose-frozen");

    await expect(
      installWithSpy(project.cwd, { frozen: true, verbose: false }),
    ).rejects.toThrow(/frozen|lock/i);

    await expect(
      installWithSpy(project.cwd, { frozen: true, verbose: true }),
    ).rejects.toThrow(/frozen|lock/i);
  });

  test("MCP frozen sync is default-off (drifted mcp.json does not fail frozen)", async () => {
    project = createTempProject();
    writeMcpLeafProject(project.cwd, "mcp-sync-off");
    const seeded = await installWithSpy(project.cwd, {
      forcedTarget: "cursor",
      forceTarget: "cursor",
    });
    expect(seeded.result).toMatchObject({ ok: true });

    writeFileSync(
      join(project.cwd, ".cursor", "mcp.json"),
      JSON.stringify({ mcpServers: { drifted: { command: "true" } } }, null, 2),
      "utf8",
    );

    const { result } = await installWithSpy(project.cwd, {
      frozen: true,
      forcedTarget: "cursor",
      forceTarget: "cursor",
    });

    expect(result).toMatchObject({ ok: true });
  });
});
