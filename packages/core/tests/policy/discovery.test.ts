/**
 * M8 dual-file policy discovery — checklist C §13–19 + policy-dual-file-discovery.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { join } from "node:path";
import {
  createTempProject,
  ensureDir,
  expectThrowsMatching,
  getApmPolicyFile,
  getBapmPolicyFile,
  getDefaultPolicyProviders,
  getDiscoverPolicyPath,
  getLoadPolicy,
  isAbsentDiscovery,
  discoveredPathOf,
  MINIMAL_WARN_POLICY,
  providersList,
  writePolicy,
  type TempProject,
} from "./helpers.ts";

describe("M8 discovery — constants + existence matrix", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("APM_POLICY_FILE / BAPM_POLICY_FILE constants", () => {
    expect(getApmPolicyFile()).toBe("apm-policy.yml");
    expect(getBapmPolicyFile()).toBe("bapm-policy.yml");
  });

  test("only apm-policy.yml → discovers that path", () => {
    project = createTempProject();
    const path = writePolicy(project.cwd, "apm-policy.yml", MINIMAL_WARN_POLICY);
    const found = getDiscoverPolicyPath()({ cwd: project.cwd });
    expect(discoveredPathOf(found)).toBe(path);
  });

  test("only bapm-policy.yml → discovers that path", () => {
    project = createTempProject();
    const path = writePolicy(project.cwd, "bapm-policy.yml", MINIMAL_WARN_POLICY);
    const found = getDiscoverPolicyPath()({ cwd: project.cwd });
    expect(discoveredPathOf(found)).toBe(path);
  });

  test("both present → hard conflict error naming both paths", () => {
    project = createTempProject();
    writePolicy(project.cwd, "apm-policy.yml", MINIMAL_WARN_POLICY);
    writePolicy(project.cwd, "bapm-policy.yml", MINIMAL_WARN_POLICY);
    const err = expectThrowsMatching(
      () => getDiscoverPolicyPath()({ cwd: project.cwd }),
      /apm-policy\.yml|bapm-policy\.yml|both|conflict/i,
    );
    const text = err instanceof Error ? err.message : String(err);
    expect(text).toMatch(/apm-policy\.yml/);
    expect(text).toMatch(/bapm-policy\.yml/);
  });

  test("neither present → absent (not dual-conflict)", () => {
    project = createTempProject();
    const found = getDiscoverPolicyPath()({ cwd: project.cwd });
    expect(isAbsentDiscovery(found)).toBe(true);
  });
});

describe("M8 discovery — explicit path wins", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("explicit path ignores sibling dual-conflict", () => {
    project = createTempProject();
    const apm = writePolicy(project.cwd, "apm-policy.yml", MINIMAL_WARN_POLICY);
    writePolicy(project.cwd, "bapm-policy.yml", MINIMAL_WARN_POLICY);
    const found = getDiscoverPolicyPath()({ cwd: project.cwd, path: apm });
    expect(discoveredPathOf(found)).toBe(apm);
  });

  test("explicit missing file fails closed on load", () => {
    project = createTempProject();
    const missing = join(project.cwd, "missing-policy.yml");
    expectThrowsMatching(
      () => getLoadPolicy()({ path: missing, cwd: project.cwd }),
      /not found|missing|ENOENT|no such file/i,
    );
  });
});

describe("M8 discovery — no parent walk", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("policy only in parent → absent at child root", () => {
    project = createTempProject();
    writePolicy(project.cwd, "bapm-policy.yml", MINIMAL_WARN_POLICY);
    const child = join(project.cwd, "nested");
    ensureDir(child);
    const found = getDiscoverPolicyPath()({ cwd: child });
    expect(isAbsentDiscovery(found)).toBe(true);
  });
});

describe("M8 discovery — providers include local + remote", () => {
  test("default provider list includes local and github-owner-dotgithub", () => {
    const providers = getDefaultPolicyProviders();
    const text = JSON.stringify(providers);
    expect(text).toMatch(/local/i);
    expect(text).toMatch(/github-owner-dotgithub/i);
  });

  test("default order is local then github-owner-dotgithub (P4 D2)", () => {
    const providers = providersList(getDefaultPolicyProviders());
    expect(providers).toContain("local");
    expect(providers).toContain("github-owner-dotgithub");
    expect(providers.indexOf("local")).toBeLessThan(providers.indexOf("github-owner-dotgithub"));
  });
});
