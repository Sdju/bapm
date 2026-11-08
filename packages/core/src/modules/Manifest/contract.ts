/**
 * Explicit `$schema` negotiation, mirroring APM 0.35
 * (`apm_cli.models.manifest_contract`).
 *
 * - Absent `$schema` → the working draft (current bapm/APM behaviour).
 * - Known OpenAPM v0.1 identities → the v0.1 contract. bapm already accepts
 *   the superset shapes those schemas describe.
 * - The source-replacements candidate → specific unsupported diagnostic:
 *   bapm does not implement `replace:` semantics.
 * - Anything else → fail closed. Unknown identities MUST NOT fall back to
 *   the working draft, so an author cannot believe a contract is enforced
 *   when it is not.
 */
import { ManifestError } from "./errors.ts";

export const OPENAPM_V01_SCHEMA_URI =
  "https://microsoft.github.io/apm/specs/schemas/manifest-v0.1.schema.json";
export const OPENAPM_V0141_SCHEMA_URI =
  "https://microsoft.github.io/apm/specs/schemas/manifest-v0.1.41.schema.json";
export const OPENAPM_V0148_SCHEMA_URI =
  "https://microsoft.github.io/apm/specs/schemas/manifest-v0.1.48.schema.json";
export const SOURCE_REPLACEMENTS_V1_SCHEMA_URI =
  "https://microsoft.github.io/apm/specs/schemas/manifest-source-replacements-v1.schema.json";

/** Contracts this client can load. The replacements candidate stays unsupported. */
export type ManifestContract = "working-draft" | "openapm-v0.1";

export const SUPPORTED_MANIFEST_SCHEMA_URIS = [
  OPENAPM_V01_SCHEMA_URI,
  OPENAPM_V0141_SCHEMA_URI,
  OPENAPM_V0148_SCHEMA_URI,
] as const;

/** Resolve the manifest contract from a raw YAML mapping. */
export function negotiateManifestContract(raw: Record<string, unknown>): ManifestContract {
  const schema = raw.$schema;
  if (schema === undefined || schema === null) {
    return "working-draft";
  }

  if (
    schema === OPENAPM_V01_SCHEMA_URI ||
    schema === OPENAPM_V0141_SCHEMA_URI ||
    schema === OPENAPM_V0148_SCHEMA_URI
  ) {
    return "openapm-v0.1";
  }

  if (schema === SOURCE_REPLACEMENTS_V1_SCHEMA_URI) {
    throw new ManifestError(
      "MANIFEST_SCHEMA_UNSUPPORTED",
      `Manifest $schema selects the source-replacements-v1 candidate contract ` +
        `(${SOURCE_REPLACEMENTS_V1_SCHEMA_URI}), which bapm does not support. ` +
        `bapm does not implement root "replace:" semantics; installing while ignoring ` +
        `the replacement would fetch the upstream source instead of the configured ` +
        `fork or local checkout. Remove the replace: block and this $schema, or use ` +
        `APM 0.35+ for this project.`,
      {
        path: "$schema",
        details: {
          schema,
          contract: "source-replacements-v1",
          supported: [...SUPPORTED_MANIFEST_SCHEMA_URIS],
        },
      },
    );
  }

  throw new ManifestError(
    "MANIFEST_SCHEMA_UNSUPPORTED",
    `Unsupported apm.yml $schema contract: ${JSON.stringify(schema)}. ` +
      `Use one of the supported explicit contracts, or omit $schema for the working draft:\n` +
      SUPPORTED_MANIFEST_SCHEMA_URIS.map((uri) => `  ${uri}`).join("\n"),
    {
      path: "$schema",
      details: { schema, supported: [...SUPPORTED_MANIFEST_SCHEMA_URIS] },
    },
  );
}
