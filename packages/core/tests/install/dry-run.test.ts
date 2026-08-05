/**
 * Install dry-run — zero durable project writes; skip write ports.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  fingerprintProject,
  hasLockfile,
  hasModules,
  installWithSpy,
  readInstallTypesSource,
  writeLeafProject,
  writeMcpLeafProject,
  type TempProject,
} from "./ux-helpers.ts";

describe("install dry-run zero-write", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("RunInstallOptions exposes dryRun (core/API boundary)", () => {
    expect(readInstallTypesSource()).toMatch(/\bdryRun\??\s*:/);
  });

  test("dry-run leaves project tree bit-identical and succeeds", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "dry-run-identical");
    const before = fingerprintProject(project.cwd);

    const { result } = await installWithSpy(project.cwd, { dryRun: true });

    expect(result).toMatchObject({ ok: true });
    expect(fingerprintProject(project.cwd)).toBe(before);
    expect(hasLockfile(project.cwd)).toBe(false);
    expect(hasModules(project.cwd)).toBe(false);
  });

  test("dry-run skips materialize and configureMcp write ports", async () => {
    project = createTempProject();
    writeMcpLeafProject(project.cwd, "dry-run-ports");

    const { result, spy } = await installWithSpy(project.cwd, {
      dryRun: true,
      forcedTarget: "cursor",
      forceTarget: "cursor",
    });

    expect(result).toMatchObject({ ok: true });
    expect(spy.materializeCalls).toBe(0);
    expect(spy.configureMcpCalls).toBe(0);
    expect(existsSync(join(project.cwd, ".cursor", "mcp.json"))).toBe(false);
  });

  test("dry-run preview does not download into modules (no full resolver path)", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "dry-run-no-resolve");

    const { result, ports } = await installWithSpy(project.cwd, { dryRun: true });

    expect(result).toMatchObject({ ok: true });
    expect(ports.downloadCalls.length).toBe(0);
    expect(hasModules(project.cwd)).toBe(false);
  });

  test("dry-run with existing lock still leaves lock/modules/harness unchanged", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "dry-run-with-lock");
    // Seed lock via a real install first, then dry-run again.
    const seeded = await installWithSpy(project.cwd, { dryRun: false });
    expect(seeded.result).toMatchObject({ ok: true });
    expect(hasLockfile(project.cwd)).toBe(true);
    const lockBefore = readFileSync(
      existsSync(join(project.cwd, "bapm.lock.yaml"))
        ? join(project.cwd, "bapm.lock.yaml")
        : join(project.cwd, "apm.lock.yaml"),
      "utf8",
    );
    const before = fingerprintProject(project.cwd);

    const { result, spy } = await installWithSpy(project.cwd, { dryRun: true });

    expect(result).toMatchObject({ ok: true });
    expect(spy.materializeCalls).toBe(0);
    expect(fingerprintProject(project.cwd)).toBe(before);
    const lockAfter = readFileSync(
      existsSync(join(project.cwd, "bapm.lock.yaml"))
        ? join(project.cwd, "bapm.lock.yaml")
        : join(project.cwd, "apm.lock.yaml"),
      "utf8",
    );
    expect(lockAfter).toBe(lockBefore);
  });
});
