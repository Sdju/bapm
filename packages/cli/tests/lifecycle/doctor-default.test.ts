/**
 * CLI doctor default (non-verbose) — compact + critical-safe; no marketplace rows;
 * doctor MUST NOT perform harness deploy.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectKnownCommand,
  lineForCheck,
  MARKETPLACE_ROW_PATTERN,
  projectFingerprintAll,
  runInProject,
  stdoutText,
  writeDoctorProject,
  type TempProject,
} from "./helpers.ts";

describe("CLI doctor default path", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("default doctor exits 0 on sane project with PASS/FAIL domain lines", async () => {
    project = createTempProject();
    writeDoctorProject(project.cwd, "p7f-default");

    const { result, stdout, combined } = await runInProject(project.cwd, ["doctor"]);
    expectKnownCommand(combined, "doctor");
    expect(result).toBe(0);

    const text = stdoutText(stdout);
    for (const name of ["git", "manifest", "lockfile", "modules"] as const) {
      const line = lineForCheck(text, name);
      expect(line, `missing PASS/FAIL line for ${name}:\n${text}`).toBeTruthy();
      expect(line!).toMatch(/^PASS\t/);
    }
    expect(text).not.toMatch(MARKETPLACE_ROW_PATTERN);
  });

  test("default doctor does not deploy harness / mutate project files", async () => {
    project = createTempProject();
    writeDoctorProject(project.cwd, "p7f-no-deploy");
    const before = projectFingerprintAll(project.cwd);

    const { result, combined } = await runInProject(project.cwd, ["doctor"]);
    expectKnownCommand(combined, "doctor");
    expect(result).toBe(0);
    expect(projectFingerprintAll(project.cwd)).toBe(before);
    expect(existsSync(join(project.cwd, "apm_modules"))).toBe(false);
    expect(existsSync(join(project.cwd, ".agents"))).toBe(false);
  });
});
