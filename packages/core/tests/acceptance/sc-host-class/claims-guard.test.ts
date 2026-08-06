/**
 * Mode B claims guard — req-sc-003/005/013/008 active with sc-host-class citations;
 * req-sc-004 stays skipped; prior soft-security / governance actives unchanged.
 */
import { describe, expect, test } from "vite-plus/test";
import {
  byId,
  checklistRows,
  citationMentionsScHostClass,
  citationPaths,
  CLAIM_ACTIVE_IDS,
  KEEP_SKIPPED_IDS,
  loadChecklist,
  pathExistsInRepo,
  PRIOR_ACTIVE_SC_IDS,
} from "./helpers.ts";

describe("sc-host-class Mode B claims guard", () => {
  test("req-sc-003/005/008/013 are active with resolving sc-host-class citations", () => {
    const rows = checklistRows(loadChecklist());
    for (const id of CLAIM_ACTIVE_IDS) {
      const row = byId(rows, id);
      expect(row.status, `${id} must be active`).toBe("active");
      expect(row.citation, `${id} must have citations`).toBeTruthy();
      expect(
        citationMentionsScHostClass(row.citation),
        `${id} citation must reference sc-host-class suite: ${row.citation}`,
      ).toBe(true);
      const paths = citationPaths(row.citation);
      expect(paths.length, `${id} needs at least one citation path`).toBeGreaterThan(0);
      for (const p of paths) {
        expect(pathExistsInRepo(p), `${id} citation missing on disk: ${p}`).toBe(true);
      }
    }
  });

  test("req-sc-004 remains skipped (soft zip / tar.gz-only)", () => {
    const rows = checklistRows(loadChecklist());
    for (const id of KEEP_SKIPPED_IDS) {
      const row = byId(rows, id);
      expect(row.status, `${id} must stay skipped`).toBe("skipped");
      expect(String(row.rationale ?? "")).toMatch(/tar\.?gz|zip|soft|container/i);
    }
  });

  test("prior soft-security and governance sc-* actives unchanged", () => {
    const rows = checklistRows(loadChecklist());
    for (const id of PRIOR_ACTIVE_SC_IDS) {
      const row = byId(rows, id);
      expect(row.status, `${id} must remain active`).toBe("active");
      expect(row.citation, `${id} must keep citations`).toBeTruthy();
      const paths = citationPaths(row.citation);
      expect(paths.length).toBeGreaterThan(0);
      for (const p of paths) {
        expect(pathExistsInRepo(p), `${id} citation missing: ${p}`).toBe(true);
      }
    }
  });
});
