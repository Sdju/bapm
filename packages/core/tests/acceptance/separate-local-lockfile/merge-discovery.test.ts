/**
 * separate-local-lockfile — merge load / discovery / dual-conflict (acceptance RED).
 *
 * Specs: lockfile-local-shared-split, lockfile-dual-file-discovery.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { discoverLockfilePath, loadLockfile, parseLockfile } from "@b-apm/core";
import {
  createTempProject,
  depNames,
  expectThrowsMatching,
  getLoadEffectiveLockfile,
  getLoadPersonalLockfileOrNull,
  getMergeLockDocuments,
  lockOf,
  minimalLockYaml,
  PERSONAL_LOCK_FILE,
  UNSUPPORTED_APM_PERSONAL_LOCK,
  writeText,
  type TempProject,
} from "./helpers.ts";

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

    const load = getLoadEffectiveLockfile();
    const effective = lockOf(load({ cwd: project.cwd }));
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

    const loadPersonal = getLoadPersonalLockfileOrNull();
    const fromChild = loadPersonal({ cwd: child });
    expect(fromChild === null || fromChild === undefined).toBe(true);

    const fromRoot = loadPersonal({ cwd: project.cwd });
    expect(fromRoot).toBeTruthy();
    expect(depNames(lockOf(fromRoot))).toEqual(expect.arrayContaining(["parent-only"]));
  });

  test("apm.local.lock.yaml is refused fail-closed", () => {
    project = createTempProject();
    writeText(join(project.cwd, "bapm.lock.yaml"), minimalLockYaml());
    writeText(
      join(project.cwd, UNSUPPORTED_APM_PERSONAL_LOCK),
      minimalLockYaml(`  - name: bad-brand
    repo_url: local:.agents/local
    source: local
    version: "0.0.1"
`),
    );

    const load = getLoadEffectiveLockfile();
    expectThrowsMatching(() => load({ cwd: project!.cwd }), /apm\.local\.lock\.yaml/i);
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

    const load = getLoadEffectiveLockfile();
    const names = depNames(lockOf(load({ cwd: project.cwd })));
    expect(names).toEqual(expect.arrayContaining(["team-git", "my-local"]));
  });

  test("identity conflict between shared and personal fails closed", () => {
    project = createTempProject();
    const identity = "https://example.invalid/conflict/pkg.git";
    writeText(
      join(project.cwd, "bapm.lock.yaml"),
      minimalLockYaml(`  - name: conflict-pkg
    repo_url: ${identity}
    source: git
    version: "1.0.0"
    resolved_commit: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
`),
    );
    writeText(
      join(project.cwd, PERSONAL_LOCK_FILE),
      minimalLockYaml(`  - name: conflict-pkg
    repo_url: ${identity}
    source: git
    version: "2.0.0"
    resolved_commit: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
`),
    );

    const merge = getMergeLockDocuments();
    const shared = parseLockfile(readFileSync(join(project.cwd, "bapm.lock.yaml"), "utf8"));
    const personal = parseLockfile(readFileSync(join(project.cwd, PERSONAL_LOCK_FILE), "utf8"));

    expectThrowsMatching(
      () =>
        merge(shared, personal, {
          sharedPath: "bapm.lock.yaml",
          personalPath: PERSONAL_LOCK_FILE,
        }),
      /conflict|bapm\.lock\.yaml|bapm\.local\.lock\.yaml|repo_url|identity/i,
    );
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

    const load = getLoadEffectiveLockfile();
    const names = depNames(lockOf(load({ cwd: project.cwd })));
    expect(names).toEqual(expect.arrayContaining(["legacy-local"]));
  });

  test("shared plus personal is not dual-conflict", () => {
    project = createTempProject();
    writeText(join(project.cwd, "bapm.lock.yaml"), minimalLockYaml());
    writeText(join(project.cwd, PERSONAL_LOCK_FILE), minimalLockYaml());

    const found = discoverLockfilePath({ cwd: project!.cwd });
    expect(found.filename).toBe("bapm.lock.yaml");
    expect(() => loadLockfile({ cwd: project!.cwd })).not.toThrow();
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
