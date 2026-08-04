/**
 * M2 e2e acceptance (checklist C §26–29):
 * - real `.samples/apm/apm.lock.yaml` (or vendored CI copy)
 * - same bytes as `bapm.lock.yaml` only
 * - both files → dual conflict matrix
 * - ported OpenAPM lock fixtures via discovery / explicit path
 * - no resolve/download/install
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { discoverLockfilePath, loadLockfile, serializeLockfile } from "@bapm/core";
import {
  createTempProject,
  depsOf,
  expectThrowsMatching,
  fixturePath,
  lockOf,
  resolveRealApmLock,
  writeLock,
  type TempProject,
} from "../helpers.ts";

describe("M2 e2e — real apm.lock.yaml", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("loads real apm.lock.yaml via discovery as apm.lock.yaml", () => {
    const real = resolveRealApmLock();
    project = createTempProject();
    cpSync(real.path, join(project.cwd, "apm.lock.yaml"));

    const found = discoverLockfilePath({ cwd: project.cwd });
    expect(found.filename).toBe("apm.lock.yaml");

    const loaded = loadLockfile({ cwd: project.cwd });
    expect(loaded.sourceFilename).toBe("apm.lock.yaml");
    const doc = lockOf(loaded);
    expect(doc.lockfile_version === "1" || doc.lockfile_version === "2").toBe(true);
    const deps = depsOf(doc);
    expect(deps.length).toBeGreaterThanOrEqual(1);
    const serialized = JSON.stringify(deps);
    expect(serialized).toMatch(/_local\/|apm-issue-autopilot|batch-bug-shepherd/);

    // M2 must not materialize install tree as a side effect of load.
    expect(existsSync(join(project.cwd, "apm_modules"))).toBe(false);
  });

  test("same bytes as bapm.lock.yaml only — discovery loads successfully", () => {
    const real = resolveRealApmLock();
    const bytes = readFileSync(real.path, "utf8");
    project = createTempProject();
    writeLock(project.cwd, "bapm.lock.yaml", bytes);

    const found = discoverLockfilePath({ cwd: project.cwd });
    expect(found.filename).toBe("bapm.lock.yaml");

    const loaded = loadLockfile({ cwd: project.cwd });
    expect(loaded.sourceFilename).toBe("bapm.lock.yaml");
    expect(depsOf(lockOf(loaded)).length).toBeGreaterThanOrEqual(1);
  });

  test("both apm.lock.yaml and bapm.lock.yaml → hard dual conflict error", () => {
    const real = resolveRealApmLock();
    const bytes = readFileSync(real.path, "utf8");
    project = createTempProject();
    writeLock(project.cwd, "apm.lock.yaml", bytes);
    writeLock(project.cwd, "bapm.lock.yaml", bytes);

    const err = expectThrowsMatching(
      () => loadLockfile({ cwd: project!.cwd }),
      /apm\.lock\.yaml|bapm\.lock\.yaml|both|conflict/i,
    );
    const text = err instanceof Error ? err.message : String(err);
    expect(text).toMatch(/apm\.lock\.yaml/);
    expect(text).toMatch(/bapm\.lock\.yaml/);
  });

  test("dual conflict matrix — discover also fails naming both paths", () => {
    const real = resolveRealApmLock();
    const bytes = readFileSync(real.path, "utf8");
    project = createTempProject();
    writeLock(project.cwd, "apm.lock.yaml", bytes);
    writeLock(project.cwd, "bapm.lock.yaml", bytes);

    const err = expectThrowsMatching(
      () => discoverLockfilePath({ cwd: project!.cwd }),
      /apm\.lock\.yaml|bapm\.lock\.yaml|both|conflict/i,
    );
    const text = err instanceof Error ? err.message : String(err);
    expect(text).toMatch(/apm\.lock\.yaml/);
    expect(text).toMatch(/bapm\.lock\.yaml/);
  });

  test("self local_deployed_* present on real lock and survive serialize", () => {
    const real = resolveRealApmLock();
    project = createTempProject();
    cpSync(real.path, join(project.cwd, "apm.lock.yaml"));
    const doc = lockOf(loadLockfile({ cwd: project.cwd }));
    // Real APM root lock carries flat self fields (§5.3).
    expect(doc.local_deployed_files).toBeTruthy();
    const yaml = serializeLockfile(doc);
    expect(yaml).toMatch(/local_deployed_files:/);
    expect(yaml).not.toMatch(/repo_url:\s*["']?\./);
  });
});

describe("M2 e2e — ported OpenAPM lock fixtures", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("v1-git-only via discovery as apm.lock.yaml", () => {
    project = createTempProject();
    cpSync(fixturePath("v1-git-only.yml"), join(project.cwd, "apm.lock.yaml"));
    const loaded = loadLockfile({ cwd: project.cwd });
    expect(loaded.sourceFilename).toBe("apm.lock.yaml");
    expect(lockOf(loaded).lockfile_version).toBe("1");
    expect(depsOf(lockOf(loaded))[0].repo_url).toBe("github.com/contoso/example");
  });

  test("v2-with-registry via discovery as bapm.lock.yaml", () => {
    project = createTempProject();
    cpSync(fixturePath("v2-with-registry.yml"), join(project.cwd, "bapm.lock.yaml"));
    const loaded = loadLockfile({ cwd: project.cwd });
    expect(loaded.sourceFilename).toBe("bapm.lock.yaml");
    expect(lockOf(loaded).lockfile_version).toBe("2");
  });

  test("round-trip-unknown-fields via explicit path", () => {
    const loaded = loadLockfile({ path: fixturePath("round-trip-unknown-fields.yml") });
    const doc = lockOf(loaded);
    expect(doc["x-acme-build-id"]).toBe("ci-12345");
    const yaml = serializeLockfile(doc);
    expect(yaml).toMatch(/future_field_unknown_in_v01/);
  });

  test("materialization-sort-exclusion via explicit path", () => {
    const loaded = loadLockfile({
      path: fixturePath("materialization-sort-exclusion.yml"),
    });
    expect(depsOf(lockOf(loaded))).toHaveLength(2);
  });

  test("load does not create apm_modules or fetch remotes", () => {
    project = createTempProject();
    cpSync(fixturePath("v1-git-only.yml"), join(project.cwd, "apm.lock.yaml"));
    mkdirSync(join(project.cwd, "sentinel-pre"), { recursive: true });
    loadLockfile({ cwd: project.cwd });
    expect(existsSync(join(project.cwd, "apm_modules"))).toBe(false);
    expect(existsSync(join(project.cwd, "sentinel-pre"))).toBe(true);
  });
});
