/**
 * M1 YAML load + OpenAPM-strict validate acceptance (checklist C §1–10, 15 +
 * delta spec `manifest-yaml-validate`). Rewrite/mf-006 is OUT of M1.
 */
import { expect, test, describe } from "vite-plus/test";
import { loadManifest } from "@bapm/core";
import { documentOf, expectThrowsMatching, fixturePath } from "./helpers.ts";

function loadFixture(name: string) {
  return loadManifest({ path: fixturePath(name) });
}

function rejectFixture(name: string, pattern: RegExp) {
  expectThrowsMatching(() => loadFixture(name), pattern);
}

describe("M1 validate — minimal / root shape", () => {
  test("minimal valid mapping {name, version} accepted", () => {
    const result = loadFixture("valid-minimal.yml");
    const doc = documentOf(result);
    expect(doc.name).toBe("my-project");
    expect(doc.version).toBe("1.0.0");
  });

  test("non-mapping root rejected", () => {
    rejectFixture("invalid-non-mapping-root.yml", /object|mapping|YAML object/i);
  });

  test("invalid YAML syntax rejected", () => {
    rejectFixture("invalid-yaml-syntax.yml", /yaml|parse|syntax|invalid/i);
  });
});

describe("M1 validate — name / version string identity", () => {
  test("missing name rejected", () => {
    rejectFixture("invalid-missing-name.yml", /name/i);
  });

  test("missing version rejected", () => {
    rejectFixture("invalid-missing-version.yml", /version/i);
  });

  test("empty name rejected", () => {
    rejectFixture("invalid-empty-name.yml", /name/i);
  });

  test("numeric version rejected", () => {
    rejectFixture("invalid-numeric-version.yml", /version|string/i);
  });

  test("non-semver string version still loads (mf-004 non-blocking)", () => {
    const result = loadFixture("valid-non-semver-version.yml");
    expect(documentOf(result).version).toBe("not-a-semver");
    // Warning channel is implementer choice; MUST NOT reject solely for non-semver.
  });
});

describe("M1 validate — dependencies shape", () => {
  test("dependencies not a mapping rejected", () => {
    rejectFixture("invalid-deps-not-mapping.yml", /dependenc/i);
  });

  test("string dep owner/repo#v1.0.0 parsed (no resolve)", () => {
    const result = loadFixture("valid-string-dep.yml");
    const doc = documentOf(result);
    const deps = doc.dependencies as { apm?: unknown[] };
    expect(Array.isArray(deps?.apm)).toBe(true);
    expect(deps.apm!.length).toBe(1);
    const entry = deps.apm![0];
    const asString =
      typeof entry === "string"
        ? entry
        : typeof entry === "object" && entry !== null && "spec" in entry
          ? String((entry as { spec: unknown }).spec)
          : JSON.stringify(entry);
    expect(asString).toMatch(/owner\/repo#v1\.0\.0/);
  });

  test("object deps: single sources, git+path virtual, parent+path, alias", () => {
    const result = loadFixture("valid-object-deps.yml");
    const doc = documentOf(result);
    const deps = doc.dependencies as { apm?: Record<string, unknown>[] };
    expect(deps?.apm?.length).toBe(6);

    const gitOnly = deps.apm![0] as Record<string, unknown>;
    expect(gitOnly.git).toMatch(/owner\/repo/);
    expect(gitOnly.ref).toBe("v1.0.0");

    const localPath = deps.apm![1] as Record<string, unknown>;
    expect(localPath.path).toBe("./packages/local-skill");

    const byId = deps.apm![2] as Record<string, unknown>;
    expect(byId.id).toBe("contoso/baseline");

    const virtual = deps.apm![3] as Record<string, unknown>;
    expect(virtual.git).toMatch(/virtual/);
    expect(virtual.path).toBe("instructions/security");

    const parent = deps.apm![4] as Record<string, unknown>;
    expect(parent.git).toBe("parent");
    expect(parent.path).toBe("packages/shared-skills");

    const aliased = deps.apm![5] as Record<string, unknown>;
    expect(aliased.alias).toBe("my-alias");
  });

  test("bare git: parent without path rejected", () => {
    rejectFixture("invalid-git-parent-no-path.yml", /parent|path/i);
  });

  test("object dep with no source key rejected", () => {
    rejectFixture("invalid-no-source-key.yml", /source|git|id|path|registry/i);
  });

  test("unknown source kind rejected", () => {
    rejectFixture("invalid-source-kind.yml", /source|kind|unsupported|unknown/i);
  });

  test("id and git together rejected", () => {
    rejectFixture("invalid-id-and-git.yml", /id|git|source/i);
  });
});

describe("M1 validate — registries", () => {
  test("valid https registry accepted", () => {
    const result = loadFixture("valid-registries-https.yml");
    const doc = documentOf(result);
    expect(doc.registries).toBeTruthy();
  });

  test("registries.default accepted when it names a declared registry", () => {
    const result = loadFixture("valid-registries-default.yml");
    const doc = documentOf(result);
    expect(doc.registries).toBeTruthy();
    expect((doc.registries as Record<string, unknown>).default).toBe("internal");
    expect((doc.registries as Record<string, { url?: string }>).internal?.url).toMatch(/^https:/);
  });

  test("registries.default rejecting undeclared name", () => {
    rejectFixture("invalid-registries-default.yml", /default|registry|unconfigured|declared/i);
  });

  test("typo registry key rejected", () => {
    rejectFixture("invalid-registries-typo.yml", /registr|frobnicate|unknown|key/i);
  });

  test("non-http(s) scheme rejected", () => {
    rejectFixture("invalid-registry-scheme.yml", /registr|scheme|https?|ftp/i);
  });
});

describe("M1 validate — extensions / unknowns (read-side; no rewrite)", () => {
  test("unknown top-level key accepted and retained", () => {
    const result = loadFixture("valid-unknown-toplevel.yml");
    const doc = documentOf(result);
    expect(doc.name).toBe("unknown-key-project");
    expect(doc.future_feature_flag ?? result).toBeTruthy();
    expect(doc.future_feature_flag).toBe(true);
  });

  test("x-* and default_host accepted and retained", () => {
    const result = loadFixture("x-extension-roundtrip.yml");
    const doc = documentOf(result);
    expect(doc.name).toBe("my-project");
    expect(doc.default_host).toBe("github.com");
    expect(doc["x-acme-telemetry"]).toBeTruthy();
    expect(doc["x-vendor-experimental"]).toBeTruthy();
  });

  test("workspaces rejected (mf-021)", () => {
    rejectFixture("invalid-workspaces.yml", /workspaces/i);
  });

  test("target and targets together rejected", () => {
    rejectFixture("invalid-target-and-targets.yml", /target/i);
  });
});

describe("M1 validate — YAML safe subset (OpenAPM-strict)", () => {
  test("anchors and aliases rejected", () => {
    rejectFixture("invalid-yaml-anchor-alias.yml", /anchor|alias|safe|yaml/i);
  });

  test("custom tags rejected", () => {
    rejectFixture("invalid-custom-tag.yml", /tag|custom|safe|yaml/i);
  });
});
