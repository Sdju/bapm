/**
 * audit / audit --ci parity: one always-on gate; --ci is accepted for APM
 * script compatibility only and must not switch behavior or be advertised as
 * a separate mode.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  runInProject,
  stdoutText,
  writeCleanAuditProject,
  writeTamperedAuditProject,
  type TempProject,
} from "./helpers.ts";

describe("audit --ci parity (always-on gate)", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("clean tree: audit and audit --ci exit 0 with identical text", async () => {
    project = createTempProject();
    writeCleanAuditProject(project.cwd, "audit-parity-clean");

    const plain = await runInProject(project.cwd, ["audit"]);
    const withCi = await runInProject(project.cwd, ["audit", "--ci"]);

    expectKnownCommand(plain.combined, "audit");
    expectKnownCommand(withCi.combined, "audit");
    expect(plain.result).toBe(0);
    expect(withCi.result).toBe(0);
    expect(stdoutText(plain.stdout).trim()).toBe(stdoutText(withCi.stdout).trim());
  });

  test("missing lock: both exit 1 with identical diagnostics", async () => {
    project = createTempProject();

    const plain = await runInProject(project.cwd, ["audit"]);
    const withCi = await runInProject(project.cwd, ["audit", "--ci"]);

    expectKnownCommand(plain.combined, "audit");
    expectKnownCommand(withCi.combined, "audit");
    expect(plain.result).toBe(1);
    expect(withCi.result).toBe(1);
    expect(stdoutText(plain.stdout).trim()).toBe(stdoutText(withCi.stdout).trim());
    expect(plain.combined).toMatch(/lockfile missing|not found/i);
  });

  test("hash mismatch: both exit 1 with identical violations", async () => {
    project = createTempProject();
    writeTamperedAuditProject(project.cwd, "audit-parity-tampered");

    const plain = await runInProject(project.cwd, ["audit"]);
    const withCi = await runInProject(project.cwd, ["audit", "--ci"]);

    expectKnownCommand(plain.combined, "audit");
    expectKnownCommand(withCi.combined, "audit");
    expect(plain.result).toBe(1);
    expect(withCi.result).toBe(1);
    expect(stdoutText(plain.stdout).trim()).toBe(stdoutText(withCi.stdout).trim());
    expect(plain.combined).toMatch(/hash mismatch|violation/i);
  });

  test("help marks --ci as compatibility-only and the gate as always on", async () => {
    project = createTempProject();
    writeCleanAuditProject(project.cwd, "audit-parity-help");

    const { result, stdout } = await runInProject(project.cwd, ["audit", "--help"]);
    const help = stdoutText(stdout);

    expect(result).toBe(0);
    expect(help).toMatch(/\[--ci\]/);
    expect(help).toMatch(/--ci/);
    expect(help).toMatch(/compatib/i);
    expect(help).toMatch(/always/i);
    expect(help).not.toMatch(/CI gate: lock present/i);
    expect(help).not.toMatch(/\bmode\b/i);
    expect(help).not.toMatch(/--ci\s+(enables?|activates?|turns on)/i);
  });
});
