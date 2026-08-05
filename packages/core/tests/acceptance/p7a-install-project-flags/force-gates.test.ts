/**
 * p7a — --force accepted; MUST NOT bypass frozen or policy.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  BLOCK_DENY_LEAF_POLICY,
  createFakePorts,
  createTempProject,
  expectRejectsMatching,
  fingerprintProject,
  getRunInstall,
  hasModulesContent,
  installWithSpy,
  writeLeafProject,
  writePolicy,
  type TempProject,
} from "./helpers.ts";

describe("p7a force does not bypass frozen/policy", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("force accepted on happy path without inventing refresh", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7a-force-ok");

    const { result } = await installWithSpy(project.cwd, { force: true });

    expect(result).toMatchObject({ ok: true });
  });

  test("force does not bypass frozen missing-lock failure", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7a-force-frozen");
    const before = fingerprintProject(project.cwd);
    const ports = createFakePorts();
    const runInstall = getRunInstall();

    await expectRejectsMatching(
      () =>
        runInstall({
          cwd: project!.cwd,
          frozen: true,
          force: true,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        }),
      /frozen|lock/i,
    );

    expect(hasModulesContent(project.cwd)).toBe(false);
    expect(fingerprintProject(project.cwd)).toBe(before);
  });

  test("force does not disable blocking deny policy", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7a-force-policy");
    writePolicy(project.cwd, BLOCK_DENY_LEAF_POLICY);
    const before = fingerprintProject(project.cwd);
    const ports = createFakePorts();
    const runInstall = getRunInstall();

    await expectRejectsMatching(
      () =>
        runInstall({
          cwd: project!.cwd,
          frozen: false,
          force: true,
          gitRemote: ports.gitRemote,
          tagLister: ports.tagLister,
          downloader: ports.downloader,
        }),
      /policy|deny|block|violat|denied/i,
    );

    expect(hasModulesContent(project.cwd)).toBe(false);
    expect(fingerprintProject(project.cwd)).toBe(before);
  });
});
