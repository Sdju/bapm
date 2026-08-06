/**
 * G1 — parseMarketplaceRef + reject semver-range in #ref
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  expectAsyncThrowMatching,
  getParseMarketplaceRef,
  parsedRefOf,
} from "./search-install-helpers.ts";

describe("mp-search-install G1 parseMarketplaceRef", () => {
  afterEach(() => {
    // no shared temp
  });

  test("tools@acme → plugin tools, marketplace acme, null ref", () => {
    const parse = getParseMarketplaceRef();
    const got = parsedRefOf(parse("tools@acme"));
    expect(got.plugin).toBe("tools");
    expect(got.marketplace).toBe("acme");
    expect(got.ref).toBeNull();
  });

  test("tools@acme#v1.2.3 accepts literal ref", () => {
    const parse = getParseMarketplaceRef();
    const got = parsedRefOf(parse("tools@acme#v1.2.3"));
    expect(got.plugin).toBe("tools");
    expect(got.marketplace).toBe("acme");
    expect(got.ref).toBe("v1.2.3");
  });

  test("semver-range chars in #ref are rejected with clear error", async () => {
    const parse = getParseMarketplaceRef();
    for (const spec of ["tools@acme#^1.0.0", "tools@acme#~1.0", "tools@acme#>=1", "x@y#!=1"]) {
      await expectAsyncThrowMatching(() => parse(spec), /semver|range|invalid.*ref|ref.*invalid|~|\^|<|>|=|!/i);
    }
  });

  test("path-like / URL specs are non-match (null), not marketplace triples", () => {
    const parse = getParseMarketplaceRef();
    expect(parse("owner/repo#main")).toBeNull();
    expect(parse("https://github.com/acme/tools#main")).toBeNull();
    expect(parse("git@github.com:acme/tools.git")).toBeNull();
  });
});
