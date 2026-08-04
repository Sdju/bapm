/**
 * M2 lockfile parse / validate / serialize acceptance (checklist C §1–16 +
 * delta spec `lockfile-yaml-rw`).
 *
 * Public API under test (design): `parseLockfile`, `loadLockfile`,
 * `serializeLockfile`, `isSemanticallyEquivalent`.
 */
import { expect, test, describe } from "vite-plus/test";
import { parse as parseYaml } from "yaml";
import {
  isSemanticallyEquivalent,
  loadLockfile,
  parseLockfile,
  serializeLockfile,
} from "@bapm/core";
import { depsOf, expectThrowsMatching, fixturePath, lockOf, readFixture } from "./helpers.ts";

function loadFixture(name: string) {
  return loadLockfile({ path: fixturePath(name) });
}

function parseFixture(name: string) {
  return parseLockfile(readFixture(name));
}

function rejectFixture(name: string, pattern: RegExp) {
  expectThrowsMatching(() => loadFixture(name), pattern);
}

function rejectParse(yaml: string, pattern: RegExp) {
  expectThrowsMatching(() => parseLockfile(yaml), pattern);
}

describe("M2 parse — container / version", () => {
  test("minimal valid {lockfile_version:1, dependencies:[]} accepted", () => {
    const result = parseFixture("minimal-v1.yml");
    const doc = lockOf(result);
    expect(doc.lockfile_version).toBe("1");
    expect(Array.isArray(doc.dependencies)).toBe(true);
    expect(depsOf(doc)).toHaveLength(0);
  });

  test('absent lockfile_version defaults to "1" on read', () => {
    const doc = lockOf(parseFixture("absent-version.yml"));
    expect(doc.lockfile_version).toBe("1");
  });

  test("serialize always emits explicit lockfile_version", () => {
    const doc = lockOf(parseFixture("absent-version.yml"));
    const yaml = serializeLockfile(doc);
    expect(yaml).toMatch(/lockfile_version:\s*["']?1["']?/);
    const reparsed = parseYaml(yaml) as Record<string, unknown>;
    expect(reparsed.lockfile_version).toBe("1");
  });

  test("non-mapping root rejected", () => {
    rejectFixture("invalid-non-mapping-root.yml", /object|mapping|LOCKFILE_FORMAT|format/i);
  });

  test("missing dependencies rejected", () => {
    rejectFixture("invalid-missing-dependencies.yml", /dependenc|LOCKFILE_FORMAT|required/i);
  });

  test('unsupported lockfile_version "3" rejected with upgrade/regenerate hint', () => {
    const err = expectThrowsMatching(
      () => loadFixture("invalid-version-3.yml"),
      /upgrade|regenerate|unsupported|version/i,
    );
    const text = err instanceof Error ? err.message : String(err);
    expect(text).toMatch(/upgrade|regenerate/i);
  });

  test("YAML anchors/aliases rejected (safe subset)", () => {
    rejectFixture("invalid-yaml-anchor-alias.yml", /anchor|alias|tag|safe|unsupported|YAML/i);
  });
});

describe("M2 parse — git / registry entry shapes", () => {
  test("git entry with repo_url + resolved_commit accepted (v1-git-only)", () => {
    const doc = lockOf(loadFixture("v1-git-only.yml"));
    expect(doc.lockfile_version).toBe("1");
    const deps = depsOf(doc);
    expect(deps.length).toBeGreaterThanOrEqual(1);
    expect(deps[0].repo_url).toBe("github.com/contoso/example");
    expect(deps[0].resolved_commit).toMatch(/^[0-9a-f]{40}$/i);
  });

  test("registry entry with required fields accepted (v2-with-registry)", () => {
    const doc = lockOf(loadFixture("v2-with-registry.yml"));
    expect(doc.lockfile_version).toBe("2");
    const registry = depsOf(doc).find((d) => d.source === "registry");
    expect(registry).toBeTruthy();
    expect(registry!.resolved_url).toBeTruthy();
    expect(registry!.resolved_hash).toBeTruthy();
  });

  test("registry entry missing resolved_hash rejected", () => {
    rejectFixture("invalid-registry-missing-hash.yml", /resolved_hash|registry|lk-003|required/i);
  });

  test('serialize registry lock keeps lockfile_version "2"', () => {
    const doc = lockOf(loadFixture("v2-with-registry.yml"));
    const yaml = serializeLockfile(doc);
    const reparsed = parseYaml(yaml) as Record<string, unknown>;
    expect(reparsed.lockfile_version).toBe("2");
  });
});

describe("M2 serialize — monotonic v2 / omit unset / sort / hashes", () => {
  test('loaded v2 without registry remains "2" on serialize (no demote)', () => {
    const doc = lockOf(loadFixture("monotonic-v2-no-registry.yml"));
    expect(doc.lockfile_version).toBe("2");
    const yaml = serializeLockfile(doc);
    const reparsed = parseYaml(yaml) as Record<string, unknown>;
    expect(reparsed.lockfile_version).toBe("2");
  });

  test("omit unset fields — no null placeholders for absent optional keys", () => {
    const yaml = serializeLockfile(
      lockOf(
        parseLockfile(`lockfile_version: "1"
dependencies:
  - repo_url: github.com/contoso/example
    resolved_commit: "7f3c9a4d2e1b8c7f0a9e6d5c4b3a2918f7e6d5c4"
`),
      ),
    );
    expect(yaml).not.toMatch(/:\s*null\b/);
    expect(yaml).not.toMatch(/\bnull\b/);
    expect(yaml).not.toMatch(/resolved_url:/);
    expect(yaml).not.toMatch(/constraint:/);
  });

  test("sort deps by (repo_url, virtual_path) not depth or materialization spelling", () => {
    const doc = lockOf(loadFixture("unordered-deps-for-sort.yml"));
    const yaml = serializeLockfile(doc);
    const reparsed = parseYaml(yaml) as { dependencies: Record<string, unknown>[] };
    const keys = reparsed.dependencies.map((d) => ({
      repo: String(d.repo_url),
      vp: d.virtual_path == null ? "" : String(d.virtual_path),
    }));
    expect(keys).toEqual([
      { repo: "github.com/contoso/alpha", vp: "instructions/a" },
      { repo: "github.com/contoso/alpha", vp: "instructions/z" },
      { repo: "github.com/contoso/zeta", vp: "" },
    ]);

    const mat = lockOf(loadFixture("materialization-sort-exclusion.yml"));
    const matYaml = serializeLockfile(mat);
    const matDeps = (parseYaml(matYaml) as { dependencies: Record<string, unknown>[] })
      .dependencies;
    expect(matDeps.map((d) => d.repo_url)).toEqual([
      "github.com/contoso/alpha",
      "github.com/contoso/beta",
    ]);
  });

  test("bare 64-hex hash normalized to sha256 envelope on read; envelope on write", () => {
    const doc = lockOf(loadFixture("bare-hash.yml"));
    const dep = depsOf(doc)[0];
    expect(String(dep.resolved_hash)).toBe(
      "sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
    const yaml = serializeLockfile(doc);
    expect(yaml).toMatch(/sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9/);
    expect(yaml).not.toMatch(
      /resolved_hash:\s*["']?b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9["']?\s*$/m,
    );
  });
});

describe("M2 round-trip — unknown / x-* / deployments / self / inventory", () => {
  test("round-trip unknown + x-* fields (round-trip-unknown-fields.yml)", () => {
    const doc = lockOf(loadFixture("round-trip-unknown-fields.yml"));
    expect(doc["x-acme-build-id"]).toBe("ci-12345");
    const dep = depsOf(doc)[0];
    expect(dep.future_field_unknown_in_v01).toBe("preserved");
    expect(dep["x-acme-attestation-id"]).toBe("att-9876");

    const yaml = serializeLockfile(doc);
    expect(yaml).toMatch(/x-acme-build-id/);
    expect(yaml).toMatch(/future_field_unknown_in_v01/);
    expect(yaml).toMatch(/x-acme-attestation-id/);
  });

  test("preserve deployments and lsp_* as unknown bags", () => {
    const doc = lockOf(loadFixture("with-deployments-lsp.yml"));
    expect(doc.deployments).toBeTruthy();
    expect(doc.lsp_servers).toBeTruthy();
    const yaml = serializeLockfile(doc);
    expect(yaml).toMatch(/deployments:/);
    expect(yaml).toMatch(/lsp_servers:/);
    expect(yaml).toMatch(/lsp_configs:/);
  });

  test("self local_deployed_* stay top-level; not emitted into dependencies", () => {
    const doc = lockOf(loadFixture("self-entry-local-deployed.yml"));
    expect(doc.local_deployed_files).toBeTruthy();
    const yaml = serializeLockfile(doc);
    const reparsed = parseYaml(yaml) as Record<string, unknown>;
    expect(reparsed.local_deployed_files).toBeTruthy();
    expect(reparsed.local_deployed_file_hashes).toBeTruthy();
    const deps = reparsed.dependencies as unknown[];
    expect(Array.isArray(deps)).toBe(true);
    for (const d of deps) {
      const entry = d as Record<string, unknown>;
      expect(entry.repo_url).not.toBe(".");
      expect(entry.virtual_path).not.toBe(".");
    }
  });

  test("inventory name/version preserved; not used as sort/identity key", () => {
    const doc = lockOf(loadFixture("inventory-name-version.yml"));
    const dep = depsOf(doc)[0];
    expect(dep.name).toBe("display-name-only");
    expect(dep.version).toBe("9.9.9");
    const yaml = serializeLockfile(doc);
    expect(yaml).toMatch(/name:\s*display-name-only/);
    expect(yaml).toMatch(/version:\s*["']?9\.9\.9["']?/);

    // req-lk-019: name/version are inventory only — sort/identity uses repo_url
    // (+ virtual_path), so renaming inventory must not change emit order keys.
    const twin = lockOf(
      parseLockfile(`lockfile_version: "1"
dependencies:
  - repo_url: github.com/contoso/example
    name: totally-different
    version: "0.0.1"
    resolved_commit: "7f3c9a4d2e1b8c7f0a9e6d5c4b3a2918f7e6d5c4"
  - repo_url: github.com/contoso/other
    name: aaa-first-alphabetically
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
`),
    );
    const ordered = (
      parseYaml(serializeLockfile(twin)) as { dependencies: Record<string, unknown>[] }
    ).dependencies.map((d) => d.repo_url);
    expect(ordered).toEqual(["github.com/contoso/example", "github.com/contoso/other"]);
  });

  test("deferred runtime field shapes accepted without resolve/hash verify", () => {
    const doc = lockOf(loadFixture("v2-with-registry.yml"));
    const gitish = depsOf(doc).find((d) => d.constraint != null);
    expect(gitish?.constraint).toBe("^1.0.0");
    expect(gitish?.resolved_tag).toBe("v1.4.2");
    expect(gitish?.resolved_at).toBeTruthy();
    expect(gitish?.tree_sha256).toMatch(/^sha256:/);
    // Round-trip must succeed without network/disk hash recompute.
    const yaml = serializeLockfile(doc);
    expect(yaml).toMatch(/constraint:/);
    expect(yaml).toMatch(/tree_sha256:/);
  });
});

describe("M2 semantic equivalence / materialization identity", () => {
  test("isSemanticallyEquivalent ignores generated_at and apm_version", () => {
    const a = lockOf(
      parseLockfile(`lockfile_version: "1"
generated_at: "2026-01-01T00:00:00Z"
apm_version: "0.1.0"
dependencies:
  - repo_url: github.com/contoso/example
    resolved_commit: "7f3c9a4d2e1b8c7f0a9e6d5c4b3a2918f7e6d5c4"
`),
    );
    const b = lockOf(
      parseLockfile(`lockfile_version: "1"
generated_at: "2099-12-31T23:59:59Z"
apm_version: "9.9.9"
dependencies:
  - repo_url: github.com/contoso/example
    resolved_commit: "7f3c9a4d2e1b8c7f0a9e6d5c4b3a2918f7e6d5c4"
`),
    );
    expect(isSemanticallyEquivalent(a, b)).toBe(true);
  });

  test("materialization_repo_url mismatch rejected", () => {
    rejectFixture(
      "invalid-materialization-mismatch.yml",
      /materialization|identity|repo_url|lk-022|mismatch/i,
    );
  });

  test("matching materialization_repo_url accepted (v1-git-only / sort fixture)", () => {
    const doc = lockOf(loadFixture("materialization-sort-exclusion.yml"));
    expect(depsOf(doc)).toHaveLength(2);
  });
});

describe("M2 parse — scalar / inline rejects", () => {
  test("scalar root rejected", () => {
    rejectParse("just-a-string\n", /object|mapping|LOCKFILE_FORMAT|format/i);
  });
});
