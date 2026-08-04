/**
 * P4 — CONFORMANCE Governance claimed; pl-003/011/012 active (openapm-conformance-statement).
 */
import { describe, expect, test } from "vite-plus/test";
import { existsSync } from "node:fs";
import {
  conformanceJsonPath,
  conformanceMdPath,
  getDefaultPolicyProviders,
  loadJsonFile,
  providersList,
  readText,
} from "./helpers.ts";

describe("P4 conformance — Governance claimed with remote/extends active", () => {
  test("CONFORMANCE.md/json exist", () => {
    expect(existsSync(conformanceMdPath)).toBe(true);
    expect(existsSync(conformanceJsonPath)).toBe(true);
  });

  test("Governance is claimed (not floor); Registry remains N/A", () => {
    const md = readText(conformanceMdPath);
    const json = loadJsonFile(conformanceJsonPath) as Record<string, unknown>;
    const classes =
      (json.classes as Record<string, unknown> | undefined) ??
      (json.claim_posture as Record<string, unknown> | undefined) ??
      {};

    const gov = String(classes.governance ?? "");
    expect(gov.toLowerCase()).toMatch(/^claimed$/);
    expect(gov.toLowerCase()).not.toMatch(/floor/);

    // MD must not describe Governance as local-only floor deferring remote/extends.
    expect(md).toMatch(/Governance[^\n]{0,120}claim/i);
    expect(md).not.toMatch(/Governance[^\n]{0,80}\*\*floor\*\*/i);

    const reg = String(classes.registry ?? "");
    expect(reg.toLowerCase()).toMatch(/n\/a|na|not.?claimed/);

    // Default discovery order documented.
    expect(md).toMatch(/github-owner-dotgithub/);
    expect(md).toMatch(/\blocal\b/);
  });

  test("req-pl-003, req-pl-011, req-pl-012 are active with citations", () => {
    const json = loadJsonFile(conformanceJsonPath) as Record<string, unknown>;
    const reqs = extractRequirements(json);
    for (const id of ["req-pl-003", "req-pl-011", "req-pl-012"] as const) {
      const row = reqs.find((r) => r.id === id);
      expect(row, `${id} must be present`).toBeTruthy();
      expect(String(row!.status).toLowerCase()).toBe("active");
      const citation = String(row!.citation ?? row!.assertion ?? "");
      expect(citation.length).toBeGreaterThan(0);
      expect(citation).not.toMatch(/P4 deferred|floor/i);
    }
  });

  test("published statement documents default provider order matching DEFAULT_POLICY_PROVIDERS", () => {
    const providers = providersList(getDefaultPolicyProviders());
    expect(providers).toContain("local");
    expect(providers).toContain("github-owner-dotgithub");

    const md = readText(conformanceMdPath);
    for (const p of providers) {
      expect(md).toMatch(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });
});

function extractRequirements(
  json: Record<string, unknown>,
): Array<{ id: string; status: string; citation?: string; assertion?: string }> {
  const list = json.requirements ?? json.reqs ?? json.rows;
  if (!Array.isArray(list)) return [];
  return list.map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r.id ?? r.req ?? ""),
      status: String(r.status ?? ""),
      citation: r.citation != null ? String(r.citation) : undefined,
      assertion: r.assertion != null ? String(r.assertion) : undefined,
    };
  });
}
