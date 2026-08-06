/**
 * sc-* skipped rationales (promoted from mp-sc-claims): drop P3 marketplace
 * catch-all and name Soft/Deferred security-depth themes.
 */
import { expect, test, describe } from "vite-plus/test";
import {
  SKIPPED_RATIONALE_THEMES,
  SKIPPED_SC_IDS,
  STALE_MARKETPLACE_CATCHALL,
  byId,
  checklistRows,
  loadChecklist,
} from "./sc-claims-helpers.ts";

describe("skipped sc rationales (security-depth honesty)", () => {
  test("residual skipped sc-* rationales must not use marketplace/plugin catch-all", () => {
    const rows = checklistRows(loadChecklist());

    for (const id of SKIPPED_SC_IDS) {
      const rationale = String(byId(rows, id).rationale ?? "");
      expect(
        rationale.length,
        `${id} needs a written rationale`,
      ).toBeGreaterThan(0);
      expect(
        STALE_MARKETPLACE_CATCHALL.test(rationale),
        `${id} still has stale marketplace catch-all: ${JSON.stringify(rationale)}`,
      ).toBe(false);
    }
  });

  test("residual skipped sc-* rationales match Soft/Deferred security-depth themes", () => {
    const rows = checklistRows(loadChecklist());

    for (const id of SKIPPED_SC_IDS) {
      const rationale = String(byId(rows, id).rationale ?? "");
      const theme = SKIPPED_RATIONALE_THEMES[id];
      expect(
        theme.test(rationale),
        `${id} rationale must name security-depth theme (${theme}): ${JSON.stringify(rationale)}`,
      ).toBe(true);
    }
  });
});
