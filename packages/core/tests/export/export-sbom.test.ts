/**
 * Export module unit coverage: purl / scrub helpers.
 * Full SBOM IO lives in sbom-io.test.ts; inventory serialize carry in resolve/inventory-carry.
 */
import { describe, expect, test } from "vite-plus/test";
import { buildPurl, scrubUrl } from "@bapm/core";

describe("Export purl / scrub", () => {
  test("scrubUrl drops userinfo and query", () => {
    expect(scrubUrl("https://user:token@github.com/example/one.git?token=secret")).toBe(
      "https://github.com/example/one.git",
    );
  });

  test("buildPurl github forge with commit", () => {
    expect(
      buildPurl({
        name: "one",
        repo_url: "github.com/example/one",
        resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      }),
    ).toBe("pkg:github/example/one@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  });

  test("buildPurl local generic without hash", () => {
    expect(
      buildPurl({
        name: "leaf",
        repo_url: "local:./leaf",
        source: "local",
        version: "0.0.1",
      }),
    ).toBe("pkg:generic/leaf");
  });
});
