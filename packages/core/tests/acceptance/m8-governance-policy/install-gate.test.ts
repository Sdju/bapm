/**
 * M8 install gate — checklist C §20–24, 25–29 + policy-install-gate / install-pipeline.
 * Asserts plan → gate → download: block aborts before modules durable writes.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import {
  BLOCK_DENY_LEAF_POLICY,
  WARN_DENY_LEAF_POLICY,
  OFF_DENY_LEAF_POLICY,
  MINIMAL_WARN_POLICY,
  createTempProject,
  expectRejectsMatching,
  getRunInstall,
  hasLockFile,
  hasModulesContent,
  writeLeafProject,
  writePolicy,
  type TempProject,
} from "./helpers.ts";

describe("M8 install gate — block / warn / off / absent / escape", () => {
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

  test("block + deny matching leaf → abort before modules", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "m8-block");
    writePolicy(project.cwd, "bapm-policy.yml", BLOCK_DENY_LEAF_POLICY);

    await expectRejectsMatching(
      () => getRunInstall()({ cwd: project.cwd }),
      /policy|deny|block|leaf|violat/i,
    );
    expect(hasModulesContent(project.cwd)).toBe(false);
  });

  test("warn + deny → install may complete with diagnostics", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "m8-warn");
    writePolicy(project.cwd, "bapm-policy.yml", WARN_DENY_LEAF_POLICY);

    const result = await getRunInstall()({ cwd: project.cwd });
    expect(result).toBeTruthy();
    const text = JSON.stringify(result);
    // Must surface policy diagnostics (not merely path containing "leaf").
    expect(text).toMatch(/policy|enforcement|violat|denied by/i);
    expect(hasModulesContent(project.cwd) || hasLockFile(project.cwd)).toBe(true);
  });

  test("enforcement off → ungated despite deny", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "m8-off");
    writePolicy(project.cwd, "bapm-policy.yml", OFF_DENY_LEAF_POLICY);

    // Pre-feature install ignores policy entirely; after apply, off must still succeed.
    // Prove policy file was considered by requiring load/gate to accept enforcement off
    // via explicit option once API exists — until then assert success + that block path
    // fails in sibling test. Here we only require durable install success.
    await getRunInstall()({ cwd: project.cwd });
    expect(hasModulesContent(project.cwd) || hasLockFile(project.cwd)).toBe(true);
  });

  test("no policy file → install proceeds ungated", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "m8-nopolic");

    await getRunInstall()({ cwd: project.cwd });
    expect(hasModulesContent(project.cwd) || hasLockFile(project.cwd)).toBe(true);
  });

  test("noPolicy option skips gate despite block deny", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "m8-escape");
    writePolicy(project.cwd, "bapm-policy.yml", BLOCK_DENY_LEAF_POLICY);

    // Baseline: without escape, block deny MUST reject (proves gate exists).
    await expectRejectsMatching(
      () => getRunInstall()({ cwd: project.cwd }),
      /policy|deny|block|violat|denied/i,
    );
    expect(hasModulesContent(project.cwd)).toBe(false);

    await getRunInstall()({ cwd: project.cwd, noPolicy: true });
    expect(hasModulesContent(project.cwd) || hasLockFile(project.cwd)).toBe(true);
  });

  test("BAPM_POLICY_DISABLE=1 skips gate", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "m8-env");
    writePolicy(project.cwd, "bapm-policy.yml", BLOCK_DENY_LEAF_POLICY);

    await expectRejectsMatching(
      () => getRunInstall()({ cwd: project.cwd }),
      /policy|deny|block|violat|denied/i,
    );

    process.env.BAPM_POLICY_DISABLE = "1";
    await getRunInstall()({ cwd: project.cwd });
    expect(hasModulesContent(project.cwd) || hasLockFile(project.cwd)).toBe(true);
  });
});

describe("M8 install gate — dual-conflict + explicit policy", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("both policy filenames → fail before modules", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "m8-dual");
    writePolicy(project.cwd, "apm-policy.yml", MINIMAL_WARN_POLICY);
    writePolicy(project.cwd, "bapm-policy.yml", BLOCK_DENY_LEAF_POLICY);

    await expectRejectsMatching(
      () => getRunInstall()({ cwd: project.cwd }),
      /apm-policy\.yml|bapm-policy\.yml|both|conflict/i,
    );
    expect(hasModulesContent(project.cwd)).toBe(false);
  });

  test("explicit policyPath uses that file even with siblings", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "m8-explicit");
    writePolicy(project.cwd, "apm-policy.yml", MINIMAL_WARN_POLICY);
    const deny = writePolicy(project.cwd, "bapm-policy.yml", BLOCK_DENY_LEAF_POLICY);

    await expectRejectsMatching(
      () => getRunInstall()({ cwd: project.cwd, policyPath: deny, policy: deny }),
      /policy|deny|block|violat|denied/i,
    );
    expect(hasModulesContent(project.cwd)).toBe(false);
  });
});
