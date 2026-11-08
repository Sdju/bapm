/**
 * `$schema` contract negotiation (APM 0.35 parity).
 *
 * Known OpenAPM v0.1 identities are accepted; the source-replacements candidate
 * stays unsupported with a specific diagnostic; unknown identities fail closed.
 */
import { describe, expect, test } from "vite-plus/test";
import {
  ManifestError,
  OPENAPM_V01_SCHEMA_URI,
  OPENAPM_V0141_SCHEMA_URI,
  OPENAPM_V0148_SCHEMA_URI,
  SOURCE_REPLACEMENTS_V1_SCHEMA_URI,
  negotiateManifestContract,
  parseManifestDocument,
  serializeManifest,
} from "@b-apm/core";
import { parse as parseYaml } from "yaml";
import { createTempProject, writeManifest, type TempProject } from "./helpers.ts";
import { loadManifest } from "@b-apm/core";

function base(schema: unknown): Record<string, unknown> {
  return { $schema: schema, name: "schema-root", version: "1.0.0" };
}

describe("manifest $schema negotiation", () => {
  test("absent $schema selects the working draft", () => {
    const result = parseManifestDocument({ name: "no-schema", version: "1.0.0" });
    expect(result.contract).toBe("working-draft");
    expect(negotiateManifestContract({ name: "x", version: "1.0.0" })).toBe("working-draft");
  });

  test.each([
    ["v0.1", OPENAPM_V01_SCHEMA_URI],
    ["v0.1.41", OPENAPM_V0141_SCHEMA_URI],
    ["v0.1.48", OPENAPM_V0148_SCHEMA_URI],
  ])("known %s URI selects OpenAPM v0.1", (_label, uri) => {
    const result = parseManifestDocument(base(uri));
    expect(result.contract).toBe("openapm-v0.1");
    // $schema is retained for round-trip and is not an unknown key warning.
    expect(result.document.$schema).toBe(uri);
    expect(result.warnings.map((w) => w.code)).not.toContain("MF_006_UNKNOWN_TOP_LEVEL");
  });

  test("unknown $schema fails closed with supported identities", () => {
    try {
      parseManifestDocument(base("https://example.test/manifest-v9.schema.json"));
      throw new Error("expected reject");
    } catch (error) {
      expect(error).toBeInstanceOf(ManifestError);
      const err = error as ManifestError;
      expect(err.code).toBe("MANIFEST_SCHEMA_UNSUPPORTED");
      expect(err.message).toMatch(/unsupported.*\$schema|unsupported.*contract/i);
      expect(err.message).toMatch(/manifest-v0\.1\.schema\.json/);
      expect(err.message).toMatch(/manifest-v0\.1\.48\.schema\.json/);
      expect(err.path).toBe("$schema");
    }
  });

  test("source-replacements candidate is a specific unsupported diagnostic", () => {
    try {
      parseManifestDocument(base(SOURCE_REPLACEMENTS_V1_SCHEMA_URI));
      throw new Error("expected reject");
    } catch (error) {
      const err = error as ManifestError;
      expect(err).toBeInstanceOf(ManifestError);
      expect(err.code).toBe("MANIFEST_SCHEMA_UNSUPPORTED");
      expect(err.message).toMatch(/source-replacements-v1/i);
      expect(err.message).toMatch(/replace:/);
      expect(err.details?.contract).toBe("source-replacements-v1");
    }
  });

  test("$schema round-trips through serialize/parse", () => {
    const first = parseManifestDocument(base(OPENAPM_V0148_SCHEMA_URI)).document;
    const reparsed = parseManifestDocument(parseYaml(serializeManifest(first)));
    expect(reparsed.document.$schema).toBe(OPENAPM_V0148_SCHEMA_URI);
    expect(reparsed.contract).toBe("openapm-v0.1");
  });

  test("loadManifest exposes the negotiated contract", () => {
    let project: TempProject | undefined;
    try {
      project = createTempProject();
      writeManifest(
        project.cwd,
        "bapm.yml",
        `$schema: ${OPENAPM_V01_SCHEMA_URI}\nname: loaded\nversion: 1.0.0\n`,
      );
      const loaded = loadManifest({ cwd: project.cwd });
      expect(loaded.contract).toBe("openapm-v0.1");
      expect(loaded.document.$schema).toBe(OPENAPM_V01_SCHEMA_URI);
    } finally {
      project?.cleanup();
    }
  });
});
