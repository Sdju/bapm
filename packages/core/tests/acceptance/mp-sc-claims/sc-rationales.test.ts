/**
 * mp-sc-claims: skipped sc-* rationales must drop P3 marketplace catch-all
 * and name Soft/Deferred security-depth themes.
 */
import { expect, test, describe } from "vite-plus/test";
import {
  SKIPPED_RATIONALE_THEMES,
  SKIPPED_SC_IDS,
  STALE_MARKETPLACE_CATCHALL,
  byId,
  checklistRows,
  loadChecklist,
} from "./helpers.ts";

describe("mp-sc-claims — skipped sc rationales (security-depth honesty)", () => {
  test("ten skipped sc-* rationales must not use marketplace/plugin catch-all", () => {
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

  test("ten skipped sc-* rationales match Soft/Deferred security-depth themes", () => {
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
