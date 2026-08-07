/**
 * CLI M8: --policy / --no-policy / install blocked|warn / help / dual-conflict.
 * Specs: cli-runtime-surface, policy-install-gate. Checklist C §25–29, 32.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { join } from "node:path";
import { runCli } from "../../src/index.ts";
import {
  BLOCK_DENY_LEAF,
  WARN_DENY_LEAF,
  MINIMAL_WARN,
  createTempProject,
  expectKnownInstallFlags,
  hasLock,
  hasModules,
  runInProject,
  withCapturedIo,
  writeLeafProject,
  writePolicy,
  type TempProject,
} from "./helpers.ts";

describe("CLI M8 install policy gate", () => {
  let project: TempProject;
  const prevBapm = process.env.BAPM_POLICY_DISABLE;
  const prevApm = process.env.APM_POLICY_DISABLE;

  afterEach(() => {
    project?.cleanup();
    if (prevBapm === undefined) delete process.env.BAPM_POLICY_DISABLE;
    else process.env.BAPM_POLICY_DISABLE = prevBapm;
    if (prevApm === undefined) delete process.env.APM_POLICY_DISABLE;
    else process.env.APM_POLICY_DISABLE = prevApm;
  });

  test("install + block deny → non-zero; no modules for proposed install", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-m8-block");
    writePolicy(project.cwd, "bapm-policy.yml", BLOCK_DENY_LEAF);

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownInstallFlags(combined);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/policy|deny|block|leaf|violat/i);
    expect(hasModules(project.cwd)).toBe(false);
  });

  test("install + warn deny → exit 0 with policy warning", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-m8-warn");
    writePolicy(project.cwd, "bapm-policy.yml", WARN_DENY_LEAF);

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownInstallFlags(combined);
    expect(result).toBe(0);
    expect(combined).toMatch(/policy|enforcement|violat|denied by/i);
    expect(hasModules(project.cwd) || hasLock(project.cwd)).toBe(true);
  });

  test("--policy path uses explicit deny/block file", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-m8-policy-flag");
    writePolicy(project.cwd, "apm-policy.yml", MINIMAL_WARN);
    const denyPath = writePolicy(project.cwd, "bapm-policy.yml", BLOCK_DENY_LEAF);

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--policy",
      denyPath,
      "--target",
      "cursor",
    ]);
    expectKnownInstallFlags(combined);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/policy|deny|block|leaf|violat/i);
    expect(hasModules(project.cwd)).toBe(false);
  });

  test("--no-policy escapes blocking deny", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-m8-no-policy");
    writePolicy(project.cwd, "bapm-policy.yml", BLOCK_DENY_LEAF);

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--no-policy",
      "--target",
      "cursor",
    ]);
    expectKnownInstallFlags(combined);
    expect(result).toBe(0);
    expect(hasModules(project.cwd) || hasLock(project.cwd)).toBe(true);
  });

  test("dual-conflict at root → error before modules", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-m8-dual");
    writePolicy(project.cwd, "apm-policy.yml", MINIMAL_WARN);
    writePolicy(project.cwd, "bapm-policy.yml", BLOCK_DENY_LEAF);

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownInstallFlags(combined);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/apm-policy\.yml|bapm-policy\.yml|both|conflict/i);
    expect(hasModules(project.cwd)).toBe(false);
  });

  test("BAPM_POLICY_DISABLE=1 escapes like --no-policy", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-m8-env");
    writePolicy(project.cwd, "bapm-policy.yml", BLOCK_DENY_LEAF);

    const blocked = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownInstallFlags(blocked.combined);
    expect(blocked.result).not.toBe(0);

    process.env.BAPM_POLICY_DISABLE = "1";
    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);
    expectKnownInstallFlags(combined);
    expect(result).toBe(0);
    expect(hasModules(project.cwd) || hasLock(project.cwd)).toBe(true);
  });
});

describe("CLI M8 install help documents policy flags", () => {
  test("install help lists --policy and --no-policy", async () => {
    const viaInstallHelp = await withCapturedIo(() => runCli(["install", "--help"]));
    const viaHelpInstall = await withCapturedIo(() => runCli(["help", "install"]));
    const text = [
      ...viaInstallHelp.stdout,
      ...viaInstallHelp.stderr,
      ...viaHelpInstall.stdout,
      ...viaHelpInstall.stderr,
    ].join("\n");

    expect(viaInstallHelp.result === 0 || viaHelpInstall.result === 0).toBe(true);
    expect(text).toMatch(/--policy/);
    expect(text).toMatch(/--no-policy/);
  });
});

describe("CLI M8 relative --policy path", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("--policy with relative bapm-policy.yml path", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-m8-rel");
    writePolicy(project.cwd, "bapm-policy.yml", BLOCK_DENY_LEAF);
    const rel = join("bapm-policy.yml");

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--policy",
      rel,
      "--target",
      "cursor",
    ]);
    expectKnownInstallFlags(combined);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/policy|deny|block|leaf|violat/i);
    expect(hasModules(project.cwd)).toBe(false);
  });
});
