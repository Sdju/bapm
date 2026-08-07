/**
 * Mode B claims guard for req-sc-003/005/013/008 (promoted from sc-host-class).
 * req-sc-004 stays skipped; prior soft-security / governance actives unchanged.
 */
import { describe, expect, test } from "vite-plus/test";
import {
  byId,
  checklistRows,
  citationPaths,
  loadChecklist,
  pathExistsInRepo,
} from "./sc-claims-helpers.ts";

const CLAIM_ACTIVE_IDS = [
  "req-sc-003",
  "req-sc-005",
  "req-sc-008",
  "req-sc-013",
] as const;

const KEEP_SKIPPED_IDS = ["req-sc-004"] as const;

const PRIOR_ACTIVE_SC_IDS = [
  "req-sc-001",
  "req-sc-002",
  "req-sc-006",
  "req-sc-007",
  "req-sc-009",
  "req-sc-010",
  "req-sc-011",
  "req-sc-012",
] as const;

/** Citations must point at promoted Auth suite paths. */
function citationMentionsHostClassSuite(citation: string | undefined): boolean {
  if (!citation) return false;
  return /packages\/core\/tests\/auth\//i.test(citation);
}

describe("sc-host-class Mode B claims guard", () => {
  test("req-sc-003/005/008/013 are active with resolving auth suite citations", () => {
    const rows = checklistRows(loadChecklist());
    for (const id of CLAIM_ACTIVE_IDS) {
      const row = byId(rows, id);
      expect(row.status, `${id} must be active`).toBe("active");
      expect(row.citation, `${id} must have citations`).toBeTruthy();
      expect(
        citationMentionsHostClassSuite(row.citation),
        `${id} citation must reference packages/core/tests/auth/: ${row.citation}`,
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
