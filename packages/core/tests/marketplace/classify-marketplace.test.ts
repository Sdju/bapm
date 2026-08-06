/**
 * G3 — Classifier: string NAME@MARKETPLACE[#ref] + object { name, marketplace, version? }
 */
import { describe, expect, test } from "vite-plus/test";
import { getClassifyDependencyRef } from "./search-install-helpers.ts";

describe("mp-search-install G3 classify marketplace forms", () => {
  test("string tools@acme classifies as marketplace", () => {
    const classify = getClassifyDependencyRef();
    const got = classify("tools@acme");
    expect(got.kind).toBe("marketplace");
  });

  test("string tools@acme#v1 classifies as marketplace", () => {
    const classify = getClassifyDependencyRef();
    const got = classify("tools@acme#v1");
    expect(got.kind).toBe("marketplace");
  });

  test("object { name, marketplace, version } classifies as marketplace", () => {
    const classify = getClassifyDependencyRef();
    const got = classify({ name: "tools", marketplace: "acme", version: "v1" });
    expect(got.kind).toBe("marketplace");
  });

  test("git owner/repo#main is not marketplace", () => {
    const classify = getClassifyDependencyRef();
    const got = classify("acme/tools#main");
    expect(got.kind).not.toBe("marketplace");
    expect(got.kind).toMatch(/^git-/);
  });
});
