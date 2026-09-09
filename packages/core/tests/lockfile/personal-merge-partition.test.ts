/**
 * Unit: merge / partition / personal lock brand for separate-local-lockfile.
 */
import { describe, expect, test } from "vite-plus/test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  APM_PERSONAL_LOCK_FILE,
  BAPM_PERSONAL_LOCK_FILE,
  discoverLockfilePath,
  loadEffectiveLockfile,
  loadLockfile,
  loadPersonalLockfileOrNull,
  mergeLockDocuments,
  parseLockfile,
  partitionAndWriteLockfiles,
  partitionLockDocument,
  stampPersonalScope,
} from "@b-apm/core";

describe("lockfile personal merge/partition", () => {
  test("merge unions distinct identities", () => {
    const shared = parseLockfile(`lockfile_version: "1"
dependencies:
  - name: team
    repo_url: https://example.invalid/team.git
    source: git
    version: "1.0.0"
    resolved_commit: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
`);
    const personal = parseLockfile(`lockfile_version: "1"
dependencies:
  - name: mine
    repo_url: local:.agents/local
    source: local
    version: "0.0.1"
`);
    const merged = mergeLockDocuments(shared, personal);
    const names = merged.dependencies.map((d) => d.name);
    expect(names).toEqual(expect.arrayContaining(["team", "mine"]));
  });

  test("merge fails closed on identity conflict", () => {
    const shared = parseLockfile(`lockfile_version: "1"
dependencies:
  - name: conflict-pkg
    repo_url: https://example.invalid/conflict/pkg.git
    source: git
    version: "1.0.0"
    resolved_commit: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
`);
    const personal = parseLockfile(`lockfile_version: "1"
dependencies:
  - name: conflict-pkg
    repo_url: https://example.invalid/conflict/pkg.git
    source: git
    version: "2.0.0"
    resolved_commit: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
`);
    expect(() =>
      mergeLockDocuments(shared, personal, {
        sharedPath: "bapm.lock.yaml",
        personalPath: BAPM_PERSONAL_LOCK_FILE,
      }),
    ).toThrow(/conflict|bapm\.lock\.yaml|bapm\.local\.lock\.yaml/i);
  });

  test("partition round-trip keeps inventory on shared", () => {
    const effective = {
      lockfile_version: "1" as const,
      dependencies: [
        { name: "shared-pkg", repo_url: "local:pkgs/a", source: "local", version: "0.0.1" },
        stampPersonalScope({
          name: "local-pkg",
          repo_url: "local:.agents/local",
          source: "local",
          version: "0.0.1",
        }),
      ],
      local_deployed_files: ["skills/x/SKILL.md"],
      local_deployed_file_hashes: {
        "skills/x/SKILL.md": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
    };
    const { shared, personal } = partitionLockDocument(effective);
    expect(shared.dependencies.map((d) => d.name)).toEqual(["shared-pkg"]);
    expect(shared.local_deployed_files).toEqual(["skills/x/SKILL.md"]);
    expect(personal?.dependencies.map((d) => d.name)).toEqual(["local-pkg"]);
    expect(personal).not.toHaveProperty("local_deployed_files");
  });

  test("refuse apm personal brand on effective load", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-lock-personal-brand-"));
    try {
      writeFileSync(join(cwd, "bapm.lock.yaml"), `lockfile_version: "1"\ndependencies: []\n`);
      writeFileSync(join(cwd, APM_PERSONAL_LOCK_FILE), `lockfile_version: "1"\ndependencies: []\n`);
      expect(() => loadEffectiveLockfile({ cwd })).toThrow(/apm\.local\.lock\.yaml/i);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("shared plus personal is not dual-conflict for discover", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-lock-no-dual-"));
    try {
      writeFileSync(join(cwd, "bapm.lock.yaml"), `lockfile_version: "1"\ndependencies: []\n`);
      writeFileSync(
        join(cwd, BAPM_PERSONAL_LOCK_FILE),
        `lockfile_version: "1"\ndependencies: []\n`,
      );
      expect(discoverLockfilePath({ cwd }).filename).toBe("bapm.lock.yaml");
      expect(() => loadLockfile({ cwd })).not.toThrow();
      expect(loadPersonalLockfileOrNull({ cwd })).toBeTruthy();
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("partition write omits personal file when empty", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-lock-part-empty-"));
    try {
      const result = partitionAndWriteLockfiles(
        {
          lockfile_version: "1",
          dependencies: [
            { name: "only-shared", repo_url: "local:pkgs/a", source: "local", version: "0.0.1" },
          ],
        },
        { cwd },
      );
      expect(result.personalPath).toBeNull();
      expect(readFileSync(result.sharedPath, "utf8")).toMatch(/only-shared/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
