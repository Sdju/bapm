/**
 * p2-lk-018: CI-truthy defaults install to frozen; --no-frozen opt-out; flag conflicts.
 * Specs: cli-runtime-surface, install-pipeline (req-lk-018).
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  hasLockfile,
  hasModules,
  runInProject,
  writeLeafProject,
  type TempProject,
} from "./helpers.ts";

describe("CLI p2-lk-018 CI-default frozen (req-lk-018)", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("CI=true install without flags is frozen — missing lock fails closed", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "ci-default-nolock");

    const { result, combined } = await runInProject(project.cwd, ["install"], {
      CI: "true",
    });

    expectKnownCommand(combined, "install");
    expect(result).not.toBe(0);
    expect(combined).toMatch(/frozen|lock/i);
    expect(hasLockfile(project.cwd)).toBe(false);
    expect(hasModules(project.cwd)).toBe(false);
  });

  test("truthy CI values (1, yes) also default to frozen without lock", async () => {
    for (const ci of ["1", "yes", "TRUE"]) {
      const p = createTempProject();
      try {
        writeLeafProject(p.cwd, `ci-truthy-${ci}`);
        const { result, combined } = await runInProject(p.cwd, ["install"], { CI: ci });
        expectKnownCommand(combined, "install");
        expect(result).not.toBe(0);
        expect(hasLockfile(p.cwd)).toBe(false);
      } finally {
        p.cleanup();
      }
    }
  });

  test("--no-frozen under CI allows lock write on non-frozen path", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "ci-no-frozen");

    const { result, combined } = await runInProject(
      project.cwd,
      ["install", "--no-frozen"],
      { CI: "true" },
    );

    expectKnownCommand(combined, "install");
    expect(combined).not.toMatch(/Unknown install flag:\s*--no-frozen/i);
    expect(result).toBe(0);
    expect(hasLockfile(project.cwd)).toBe(true);
    expect(hasModules(project.cwd)).toBe(true);
  });

  test("--frozen and --no-frozen conflict — non-zero, no mutation", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "flag-conflict");

    const { result, combined } = await runInProject(
      project.cwd,
      ["install", "--frozen", "--no-frozen"],
      { CI: undefined },
    );

    expectKnownCommand(combined, "install");
    expect(result).not.toBe(0);
    // Must be an explicit conflict, not merely "unknown flag: --no-frozen".
    expect(combined).toMatch(/conflict|mutually|cannot combine|both|--frozen.*--no-frozen|--no-frozen.*--frozen/i);
    expect(combined).not.toMatch(/Unknown install flag:\s*--no-frozen/i);
    expect(hasLockfile(project.cwd)).toBe(false);
    expect(hasModules(project.cwd)).toBe(false);
  });

  test("CI-default plus --update rejected without mutation", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "ci-update-reject");

    const { result, combined } = await runInProject(
      project.cwd,
      ["install", "--update"],
      { CI: "true" },
    );

    expectKnownCommand(combined, "install");
    expect(result).not.toBe(0);
    expect(combined).toMatch(/frozen|update/i);
    expect(hasLockfile(project.cwd)).toBe(false);
    expect(hasModules(project.cwd)).toBe(false);
  });

  test("non-truthy CI stays non-frozen by default — lock write allowed", async () => {
    const cases: Array<string | undefined> = [undefined, "", "0", "false", "FALSE", "False"];
    for (const ci of cases) {
      const p = createTempProject();
      try {
        writeLeafProject(p.cwd, `non-ci-${ci ?? "unset"}`);
        const env: Record<string, string | undefined> =
          ci === undefined ? { CI: undefined } : { CI: ci };
        const { result, combined } = await runInProject(p.cwd, ["install"], env);
        expectKnownCommand(combined, "install");
        expect(result).toBe(0);
        expect(hasLockfile(p.cwd)).toBe(true);
        expect(hasModules(p.cwd)).toBe(true);
      } finally {
        p.cleanup();
      }
    }
  });

  test("explicit --frozen force-on under non-truthy CI still fails without lock", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "force-frozen");

    const { result, combined } = await runInProject(
      project.cwd,
      ["install", "--frozen"],
      { CI: "false" },
    );

    expectKnownCommand(combined, "install");
    expect(result).not.toBe(0);
    expect(hasLockfile(project.cwd)).toBe(false);
  });
});
