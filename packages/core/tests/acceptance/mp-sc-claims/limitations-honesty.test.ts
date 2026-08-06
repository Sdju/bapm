/**
 * mp-sc-claims: Limitations / scope_out acknowledge marketplace floor;
 * residual gaps are security-depth / approve / hosts-auth — not marketplace OOS.
 */
import { expect, test, describe } from "vite-plus/test";
import { existsSync } from "node:fs";
import {
  ABSOLUTE_MARKETPLACE_OOS,
  STALE_MARKETPLACE_CATCHALL,
  conformanceJsonPath,
  conformanceMdPath,
  limitationsBlob,
  limitationsNameResidualSecurity,
  loadChecklist,
  readText,
  scopeOutBlob,
  scopeOutHasAbsoluteMarketplace,
} from "./helpers.ts";

describe("mp-sc-claims — Limitations / Scope-out honesty", () => {
  test("checklist limitations must not list marketplace/plugin as absolute OOS", () => {
    const doc = loadChecklist();
    const blob = limitationsBlob(doc);

    expect(
      /Marketplace\s*\/\s*plugin surfaces are out of scope/i.test(blob),
      `checklist limitations still claim marketplace/plugin absolute OOS:\n${blob}`,
    ).toBe(false);

    // Governance UX line must not imply marketplace floor is absent.
    expect(
      /marketplace\s*\/\s*plugin governance UX are out of scope/i.test(blob),
      `checklist limitations still bundle marketplace floor into OOS:\n${blob}`,
    ).toBe(false);
  });

  test("checklist scope_out must not include absolute marketplace/plugin token", () => {
    const doc = loadChecklist();
    expect(
      scopeOutHasAbsoluteMarketplace(doc),
      `scope_out still has marketplace/plugin: ${scopeOutBlob(doc)}`,
    ).toBe(false);
  });

  test("checklist limitations/scope_out name residual security-depth gaps", () => {
    const doc = loadChecklist();
    const blob = `${limitationsBlob(doc)}\n${scopeOutBlob(doc)}`;

    expect(
      limitationsNameResidualSecurity(blob),
      `expected residual host-auth / approve / soft §10 wording in:\n${blob}`,
    ).toBe(true);

    // Approve/deny UX remains a legitimate residual scope-out.
    expect(
      /approve|deny/i.test(blob),
      `expected approve/deny residual in limitations/scope_out:\n${blob}`,
    ).toBe(true);
  });

  test("generated CONFORMANCE.md Limitations / Scope out mirror honesty", () => {
    expect(existsSync(conformanceMdPath), conformanceMdPath).toBe(true);
    const md = readText(conformanceMdPath);

    expect(
      ABSOLUTE_MARKETPLACE_OOS.test(md) ||
        /Marketplace\s*\/\s*plugin surfaces are out of scope/i.test(md),
      "CONFORMANCE.md still lists marketplace/plugin as absolute OOS",
    ).toBe(false);

    expect(
      /^-\s*marketplace\/plugin\s*$/m.test(md),
      "CONFORMANCE.md Scope out still lists marketplace/plugin",
    ).toBe(false);

    // Skipped sc waiver block must not retain P3 marketplace catch-all.
    expect(
      STALE_MARKETPLACE_CATCHALL.test(md),
      "CONFORMANCE.md still carries stale marketplace catch-all on sc-* rows",
    ).toBe(false);

    expect(
      limitationsNameResidualSecurity(md),
      "CONFORMANCE.md Limitations must name residual security-depth gaps",
    ).toBe(true);
  });

  test("generated CONFORMANCE.json does not encode marketplace absolute OOS for sc honesty", () => {
    expect(existsSync(conformanceJsonPath), conformanceJsonPath).toBe(true);
    const json = readText(conformanceJsonPath);

    expect(
      /Marketplace\s*\/\s*plugin surfaces are out of scope/i.test(json),
      "CONFORMANCE.json still has absolute marketplace OOS limitation",
    ).toBe(false);

    expect(
      STALE_MARKETPLACE_CATCHALL.test(json),
      "CONFORMANCE.json still has stale marketplace catch-all rationales",
    ).toBe(false);
  });
});
