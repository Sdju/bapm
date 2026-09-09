/**
 * Integration: effective load / discovery for shared + personal lockfiles
 * (promoted from separate-local-lockfile acceptance).
 *
 * Unit merge/partition coverage lives in personal-merge-partition.test.ts.
 * Specs: lockfile-local-shared-split, lockfile-dual-file-discovery.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  discoverLockfilePath,
  loadEffectiveLockfile,
  loadPersonalLockfileOrNull,
} from "@b-apm/core";
import {
  createTempProject,
  depNames,
  expectThrowsMatching,
  lockOf,
  minimalLockYaml,
  PERSONAL_LOCK_FILE,
  writeText,
  type TempProject,
} from "./separate-local-lockfile-helpers.ts";

describe("separate-local-lockfile — merge and discovery", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("missing personal lock is fine without local sources", () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.lock.yaml"),
      minimalLockYaml(`  - name: team-pkg
    repo_url: https://example.invalid/team/pkg.git
    source: git
    version: "1.0.0"
    resolved_commit: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
`),
    );

    const effective = lockOf(loadEffectiveLockfile({ cwd: project.cwd }));
    expect(depNames(effective)).toEqual(expect.arrayContaining(["team-pkg"]));
  });

  test("personal lock loads from project root only (no parent walk)", () => {
    project = createTempProject();
    const child = join(project.cwd, "child");
    mkdirSync(child, { recursive: true });
    writeText(
      join(project.cwd, PERSONAL_LOCK_FILE),
      minimalLockYaml(`  - name: parent-only
    repo_url: local:.agents/local
    source: local
    version: "0.0.1"
`),
    );
    writeText(join(child, "bapm.lock.yaml"), minimalLockYaml());

    const fromChild = loadPersonalLockfileOrNull({ cwd: child });
    expect(fromChild === null || fromChild === undefined).toBe(true);

    const fromRoot = loadPersonalLockfileOrNull({ cwd: project.cwd });
    expect(fromRoot).toBeTruthy();
    expect(depNames(lockOf(fromRoot))).toEqual(expect.arrayContaining(["parent-only"]));
  });

  test("union includes both shared and personal scopes", () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.lock.yaml"),
      minimalLockYaml(`  - name: team-git
    repo_url: https://example.invalid/team/git.git
    source: git
    version: "1.0.0"
    resolved_commit: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
`),
    );
    writeText(
      join(project.cwd, PERSONAL_LOCK_FILE),
      minimalLockYaml(`  - name: my-local
    repo_url: local:.agents/local
    source: local
    version: "0.0.1"
`),
    );

    const names = depNames(lockOf(loadEffectiveLockfile({ cwd: project.cwd })));
    expect(names).toEqual(expect.arrayContaining(["team-git", "my-local"]));
  });

  test("read before migrate still sees personal-scope pin in shared lock", () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.lock.yaml"),
      minimalLockYaml(`  - name: legacy-local
    repo_url: local:.agents/local
    source: local
    version: "0.0.1"
    x-bapm-lock-scope: local
`),
    );

    const names = depNames(lockOf(loadEffectiveLockfile({ cwd: project.cwd })));
    expect(names).toEqual(expect.arrayContaining(["legacy-local"]));
  });

  test("both shared brands still conflict regardless of personal lock", () => {
    project = createTempProject();
    writeText(join(project.cwd, "apm.lock.yaml"), minimalLockYaml());
    writeText(join(project.cwd, "bapm.lock.yaml"), minimalLockYaml());
    writeText(join(project.cwd, PERSONAL_LOCK_FILE), minimalLockYaml());

    expectThrowsMatching(
      () => discoverLockfilePath({ cwd: project!.cwd }),
      /apm\.lock\.yaml|bapm\.lock\.yaml|both|conflict|DUAL/i,
    );
  });
});
