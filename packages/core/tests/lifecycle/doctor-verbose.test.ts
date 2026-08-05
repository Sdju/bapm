/**
 * Core doctor verbose enrichment — git/manifest/lockfile/modules; default critical-safe;
 * no marketplace rows; SHOULD network (verbose-only) + auth-env informational.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  checksOf,
  createTempProject,
  ensureModulesDir,
  exitCodeOf,
  getRunDoctor,
  lineForCheck,
  MARKETPLACE_NAME_PATTERN,
  messageOf,
  textOf,
  writeDoctorProject,
  type TempProject,
} from "./helpers.ts";

describe("core doctor verbose enrichment", () => {
  let project: TempProject | undefined;
  const prevGithub = process.env.GITHUB_TOKEN;
  const prevGh = process.env.GH_TOKEN;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
    if (prevGithub === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = prevGithub;
    if (prevGh === undefined) delete process.env.GH_TOKEN;
    else process.env.GH_TOKEN = prevGh;
  });

  test("default doctor remains compact PASS/FAIL table with exit 0", async () => {
    project = createTempProject();
    writeDoctorProject(project.cwd, "p7f-core-default");
    const runDoctor = getRunDoctor();

    const result = await runDoctor({
      cwd: project.cwd,
      gitAvailable: true,
      hasGit: true,
    });
    expect(exitCodeOf(result)).toBe(0);

    const text = textOf(result);
    for (const name of ["git", "manifest", "lockfile", "modules"] as const) {
      expect(lineForCheck(text, name)).toMatch(/^PASS\t/);
    }
    for (const check of checksOf(result)) {
      expect(String(check.name)).not.toMatch(MARKETPLACE_NAME_PATTERN);
    }
  });

  test("verbose: true enriches all four domain messages", async () => {
    project = createTempProject();
    writeDoctorProject(project.cwd, "p7f-core-verbose");
    ensureModulesDir(project.cwd, ["alpha", "beta"]);
    const runDoctor = getRunDoctor();

    const compact = await runDoctor({
      cwd: project.cwd,
      gitAvailable: true,
      hasGit: true,
      whichGit: () => "/usr/bin/git",
    });
    const verbose = await runDoctor({
      cwd: project.cwd,
      verbose: true,
      // Prefer real git --version when available; boolean hooks must still allow richer miss/version text.
      whichGit: () => "/usr/bin/git",
    });

    expect(exitCodeOf(verbose)).toBe(0);
    expect(exitCodeOf(compact)).toBe(0);

    const gitMsg = messageOf(verbose, "git");
    expect(gitMsg).toMatch(/git version|\d+\.\d+|available/i);
    expect(gitMsg.length).toBeGreaterThan(messageOf(compact, "git").length);

    const manifestMsg = messageOf(verbose, "manifest");
    expect(manifestMsg).toMatch(/bapm\.yml|apm\.yml/);
    expect(manifestMsg).toMatch(/p7f-core-verbose/);
    expect(manifestMsg).toMatch(/9\.9\.9/);
    expect(manifestMsg.length).toBeGreaterThan(messageOf(compact, "manifest").length);

    const lockMsg = messageOf(verbose, "lockfile");
    expect(lockMsg).toMatch(/bapm\.lock\.yaml|apm\.lock\.yaml/);
    expect(lockMsg).toMatch(/lockfile_version|"1"|'1'|\b1\b/i);
    expect(lockMsg).toMatch(/2|dependencies|count/i);
    expect(lockMsg.length).toBeGreaterThan(messageOf(compact, "lockfile").length);

    const modulesMsg = messageOf(verbose, "modules");
    expect(modulesMsg).toMatch(/apm_modules/);
    expect(modulesMsg).toMatch(/2|entr|exist/i);
    expect(modulesMsg.length).toBeGreaterThan(messageOf(compact, "modules").length);

    // Verbose MUST NOT flip criticality of the four domains.
    for (const name of ["git", "manifest", "lockfile", "modules"] as const) {
      const c = checksOf(compact).find((x) => x.name === name);
      const v = checksOf(verbose).find((x) => x.name === name);
      expect(v?.critical).toBe(c?.critical);
      expect(v?.ok).toBe(c?.ok);
    }

    for (const check of checksOf(verbose)) {
      expect(String(check.name)).not.toMatch(MARKETPLACE_NAME_PATTERN);
    }
  });

  test("verbose modules absent reports explicit absent/ok with path", async () => {
    project = createTempProject();
    writeDoctorProject(project.cwd, "p7f-core-modules-absent");
    const runDoctor = getRunDoctor();

    const result = await runDoctor({
      cwd: project.cwd,
      verbose: true,
      gitAvailable: true,
      hasGit: true,
    });
    expect(exitCodeOf(result)).toBe(0);
    const modulesMsg = messageOf(result, "modules");
    expect(modulesMsg).toMatch(/apm_modules/);
    expect(modulesMsg).toMatch(/absent/i);
  });

  test("verbose-only network probe is informational (never critical alone)", async () => {
    project = createTempProject();
    writeDoctorProject(project.cwd, "p7f-core-network");
    const runDoctor = getRunDoctor();

    const result = await runDoctor({
      cwd: project.cwd,
      verbose: true,
      gitAvailable: true,
      hasGit: true,
    });
    expect(exitCodeOf(result)).toBe(0);

    const network = checksOf(result).find((c) => c.name === "network");
    expect(network, `expected network check when verbose:\n${textOf(result)}`).toBeTruthy();
    expect(network!.critical).toBe(false);
  });

  test("auth-env informational never critical and prints no secrets", async () => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    project = createTempProject();
    writeDoctorProject(project.cwd, "p7f-core-auth");
    const runDoctor = getRunDoctor();

    const result = await runDoctor({
      cwd: project.cwd,
      gitAvailable: true,
      hasGit: true,
    });
    expect(exitCodeOf(result)).toBe(0);

    const auth = checksOf(result).find(
      (c) => c.name === "auth" || c.name === "auth-env",
    );
    expect(auth, `expected auth/auth-env check:\n${textOf(result)}`).toBeTruthy();
    expect(auth!.critical).toBe(false);
    expect(auth!.ok).toBe(true);
    expect(textOf(result)).not.toMatch(/ghp_|github_pat_/i);

    process.env.GH_TOKEN = "gho_secret_value_must_not_leak";
    const withToken = await runDoctor({
      cwd: project.cwd,
      gitAvailable: true,
      hasGit: true,
    });
    expect(exitCodeOf(withToken)).toBe(0);
    expect(textOf(withToken)).not.toContain("gho_secret_value_must_not_leak");
    expect(textOf(withToken)).toMatch(/GH_TOKEN|GITHUB_TOKEN/i);
  });

  test("critical git miss still non-zero with verbose", async () => {
    project = createTempProject();
    writeDoctorProject(project.cwd, "p7f-core-nogit");
    const runDoctor = getRunDoctor();

    const result = await runDoctor({
      cwd: project.cwd,
      verbose: true,
      gitAvailable: false,
      hasGit: false,
      whichGit: () => null,
      findGit: () => undefined,
    });
    expect(exitCodeOf(result)).not.toBe(0);
    expect(messageOf(result, "git")).toMatch(/miss|missing|not on PATH|unavailable|timeout/i);
  });
});
