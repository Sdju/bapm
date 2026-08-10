/**
 * Mode B seed oracles — valid/invalid fixtures from tests/fixtures/spec-conformance/.
 * Governance extends fixtures are claimed active (P4).
 */
import { expect, test, describe } from "vite-plus/test";
import { existsSync } from "node:fs";
import { loadYamlDocument, parseLockfile, parseManifest, parsePolicy } from "@b-apm/core";
import { fixturePath, readFixture } from "./helpers.ts";

function expectRejects(fn: () => unknown, pattern: RegExp): void {
  try {
    fn();
    expect.fail("expected throw");
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    expect(text).toMatch(pattern);
  }
}

describe("Mode B seed oracles — manifest", () => {
  test("valid-minimal.yml parses", () => {
    const path = fixturePath("manifest/valid-minimal.yml");
    expect(existsSync(path)).toBe(true);
    const doc = parseManifest(loadYamlDocument(readFixture("manifest/valid-minimal.yml"), path));
    expect(doc.name).toBeTruthy();
    expect(doc.version).toBeTruthy();
  });

  test("x-extension-roundtrip.yml preserves top-level x-* keys", () => {
    const path = fixturePath("manifest/x-extension-roundtrip.yml");
    const doc = parseManifest(
      loadYamlDocument(readFixture("manifest/x-extension-roundtrip.yml"), path),
    ) as Record<string, unknown>;
    expect(doc["x-acme-telemetry"]).toBeTruthy();
    expect(doc["x-vendor-experimental"]).toBeTruthy();
  });

  test("invalid-missing-name.yml rejected", () => {
    const path = fixturePath("manifest/invalid-missing-name.yml");
    expectRejects(
      () => parseManifest(loadYamlDocument(readFixture("manifest/invalid-missing-name.yml"), path)),
      /name/i,
    );
  });

  test("invalid-no-source-key.yml rejected", () => {
    const path = fixturePath("manifest/invalid-no-source-key.yml");
    expectRejects(
      () =>
        parseManifest(loadYamlDocument(readFixture("manifest/invalid-no-source-key.yml"), path)),
      /source|git|id|path|registry|dependenc/i,
    );
  });

  test("invalid-source-kind.yml rejected", () => {
    const path = fixturePath("manifest/invalid-source-kind.yml");
    expectRejects(
      () => parseManifest(loadYamlDocument(readFixture("manifest/invalid-source-kind.yml"), path)),
      /source|kind|git|id|path|registry|unknown|invalid/i,
    );
  });

  test("invalid-registry-scheme.yml rejected", () => {
    const path = fixturePath("manifest/invalid-registry-scheme.yml");
    expectRejects(
      () =>
        parseManifest(loadYamlDocument(readFixture("manifest/invalid-registry-scheme.yml"), path)),
      /scheme|https|registry|url/i,
    );
  });

  test("invalid-registries-typo.yml rejected", () => {
    const path = fixturePath("manifest/invalid-registries-typo.yml");
    expectRejects(
      () =>
        parseManifest(loadYamlDocument(readFixture("manifest/invalid-registries-typo.yml"), path)),
      /registr|typo|unknown|invalid/i,
    );
  });

  test("invalid-yaml-anchor-alias.yml rejected (mf-020)", () => {
    const path = fixturePath("manifest/invalid-yaml-anchor-alias.yml");
    expectRejects(
      () =>
        parseManifest(
          loadYamlDocument(readFixture("manifest/invalid-yaml-anchor-alias.yml"), path),
        ),
      /anchor|alias|safe|yaml|tag/i,
    );
  });
});

describe("Mode B seed oracles — lockfile", () => {
  test("v2-with-registry.yml parses", () => {
    const doc = parseLockfile(readFixture("lockfile/v2-with-registry.yml"));
    expect(doc.lockfile_version).toBe("2");
    expect(Array.isArray(doc.dependencies)).toBe(true);
    expect(doc.dependencies.length).toBeGreaterThan(0);
  });

  test("v1-git-only.yml remains parseable", () => {
    const doc = parseLockfile(readFixture("lockfile/v1-git-only.yml"));
    expect(["1", "2"]).toContain(doc.lockfile_version);
    expect(doc.dependencies.length).toBeGreaterThan(0);
  });

  test("round-trip-unknown-fields.yml preserves future_/x-* dep keys", () => {
    const doc = parseLockfile(readFixture("lockfile/round-trip-unknown-fields.yml")) as {
      dependencies: Array<Record<string, unknown>>;
    };
    const dep = doc.dependencies[0];
    expect(dep.future_field_unknown_in_v01).toBe("preserved");
    expect(dep["x-acme-attestation-id"]).toBeTruthy();
  });
});

describe("Mode B seed oracles — policy (governance claimed)", () => {
  test("security-integrity.yml parses for governance claim", () => {
    const path = fixturePath("policy/security-integrity.yml");
    expect(existsSync(path)).toBe(true);
    const result = parsePolicy(
      loadYamlDocument(readFixture("policy/security-integrity.yml"), path),
    );
    expect(result.document?.name ?? result.policy?.name).toBeTruthy();
    expect(result.document?.security ?? result.policy?.security).toBeTruthy();
  });

  test("extends fixtures parse; cycle fixture retains self-extends for resolve reject", () => {
    expect(existsSync(fixturePath("policy/valid-extends.yml"))).toBe(true);
    expect(existsSync(fixturePath("policy/invalid-extends-cycle.yml"))).toBe(true);
    const valid = parsePolicy(
      loadYamlDocument(
        readFixture("policy/valid-extends.yml"),
        fixturePath("policy/valid-extends.yml"),
      ),
    );
    expect(String(valid.document.extends ?? valid.policy?.extends)).toMatch(/contoso-enterprise/);
    const cycle = parsePolicy(
      loadYamlDocument(
        readFixture("policy/invalid-extends-cycle.yml"),
        fixturePath("policy/invalid-extends-cycle.yml"),
      ),
    );
    expect(String(cycle.document.extends ?? cycle.policy?.extends)).toMatch(
      /invalid-extends-cycle/,
    );
  });
});
