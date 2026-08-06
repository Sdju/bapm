/**
 * Thin validateMarketplace (schema + duplicate names).
 */
import { describe, expect, test } from "vite-plus/test";
import {
  FIXTURE_CLAUDE_OK,
  FIXTURE_DUP_NAMES,
  getParseMarketplaceJson,
  getValidateMarketplace,
  validationFailed,
  validationMentionsDuplicate,
} from "./helpers.ts";

describe("mp-consumer-registry thin validate", () => {
  test("validate fails on case-insensitive duplicate plugin names", () => {
    const parse = getParseMarketplaceJson();
    const validate = getValidateMarketplace();
    // Parser may keep both entries; validate MUST fail on duplicates.
    let manifest: unknown;
    try {
      manifest = parse(FIXTURE_DUP_NAMES);
    } catch {
      // If parse already rejects duplicates, that still satisfies fail-closed intent
      // for the document — but thin validate is the required surface; rethrow soft.
      throw new TypeError(
        "parse rejected duplicate fixture before validate; apply should parse then fail validate",
      );
    }
    const results = validate(manifest);
    expect(validationFailed(results)).toBe(true);
    expect(validationMentionsDuplicate(results)).toBe(true);
  });

  test("validate passes for well-formed unique plugins", () => {
    const parse = getParseMarketplaceJson();
    const validate = getValidateMarketplace();
    const manifest = parse(FIXTURE_CLAUDE_OK);
    const results = validate(manifest);
    expect(validationFailed(results)).toBe(false);
  });
});
