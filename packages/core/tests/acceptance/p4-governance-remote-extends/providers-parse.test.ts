/**
 * P4 — pl-011 default providers + discovery: parse selection (policy-dual-file / yaml-parse).
 */
import { describe, expect, test } from "vite-plus/test";
import {
  getDefaultPolicyProviders,
  getParsePolicy,
  policyOf,
  providersList,
  warningsOf,
} from "./helpers.ts";

describe("P4 providers — DEFAULT_POLICY_PROVIDERS includes local + remote", () => {
  test("default list includes local and github-owner-dotgithub", () => {
    const providers = providersList(getDefaultPolicyProviders());
    expect(providers).toContain("local");
    expect(providers).toContain("github-owner-dotgithub");
    // Documented order: local first, then remote (design D2).
    expect(providers.indexOf("local")).toBeLessThan(
      providers.indexOf("github-owner-dotgithub"),
    );
  });
});

describe("P4 parse — extends + discovery fields", () => {
  test("extends string preserved without unknown-key warning", () => {
    const result = getParsePolicy()({
      name: "contoso-baseline",
      extends: "contoso-enterprise/policy",
      enforcement: "block",
    });
    const doc = policyOf(result);
    expect(String(doc.extends)).toBe("contoso-enterprise/policy");
    const warnText = JSON.stringify(warningsOf(result));
    expect(warnText).not.toMatch(/extends/i);
  });

  test("discovery.providers parses without unknown-key warning", () => {
    const result = getParsePolicy()({
      name: "local-only",
      enforcement: "warn",
      discovery: { providers: ["local"] },
    });
    const doc = policyOf(result);
    const discovery = doc.discovery as Record<string, unknown> | undefined;
    expect(discovery).toBeTruthy();
    expect(JSON.stringify(discovery)).toMatch(/local/);
    const warnText = JSON.stringify(warningsOf(result));
    expect(warnText).not.toMatch(/discovery/i);
  });
});
