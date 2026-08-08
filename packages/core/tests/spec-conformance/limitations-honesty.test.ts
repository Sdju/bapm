/**
 * Limitations / scope_out honesty (promoted from mp-sc-claims): marketplace
 * floor acknowledged; residual gaps are security-depth — not marketplace OOS.
 * Source of truth: checklist.yml (CONFORMANCE.* via conformance:check).
 */
import { expect, test, describe } from "vite-plus/test";
import {
  limitationsBlob,
  limitationsNameResidualSecurity,
  loadChecklist,
  scopeOutBlob,
  scopeOutHasAbsoluteMarketplace,
} from "./sc-claims-helpers.ts";

describe("Limitations / Scope-out honesty", () => {
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

    // Soft approve UX / ungated hooks residual still named after sc-010 claim.
    expect(
      /approve|deny|hooks|bin|canvas/i.test(blob),
      `expected soft approve UX or ungated hooks residual in limitations/scope_out:\n${blob}`,
    ).toBe(true);
  });
});
