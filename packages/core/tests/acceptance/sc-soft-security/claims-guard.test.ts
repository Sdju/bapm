/**
 * Mode B claim guard for sc-soft-security (G9–G10) — RED until apply flips claims.
 */
import { describe, expect, test } from "vite-plus/test";
import { existsSync } from "node:fs";
import { byId, checklistPath, loadChecklistRows } from "./helpers.ts";

const CLAIM_ACTIVE = ["req-sc-002", "req-sc-006"] as const;
const STAY_SKIPPED = [
  "req-sc-003",
  "req-sc-004",
  "req-sc-005",
  "req-sc-008",
  "req-sc-010",
  "req-sc-011",
  "req-sc-012",
  "req-sc-013",
] as const;
const STAY_ACTIVE = ["req-sc-001", "req-sc-007", "req-sc-009"] as const;

describe("sc-soft-security Mode B claim set", () => {
  test("Mode B checklist.yml is present", () => {
    expect(existsSync(checklistPath), `expected ${checklistPath}`).toBe(true);
  });

  test("req-sc-002 and req-sc-006 are active with citations (implement-then-claim)", () => {
    const rows = loadChecklistRows();
    for (const id of CLAIM_ACTIVE) {
      const row = byId(rows, id);
      expect(row.status, `${id} must be active after sc-soft-security`).toBe("active");
      const citation = String((row as { citation?: string }).citation ?? "");
      expect(citation.length, `${id} needs Mode B citation`).toBeGreaterThan(0);
      expect(citation).toMatch(/sc-soft-security/);
    }
  });

  test("deferred sc-* stay skipped; sc-004 rationale mentions caps-on-zip", () => {
    const rows = loadChecklistRows();
    for (const id of STAY_SKIPPED) {
      const row = byId(rows, id);
      expect(row.status, `${id} must remain skipped`).toBe("skipped");
    }
    const sc004 = byId(rows, "req-sc-004");
    const rationale = String(sc004.rationale ?? "");
    expect(rationale).toMatch(/zip|caps?|100\s*MB|10\s*k|tar\.?gz|container/i);
  });

  test("req-sc-001 / 007 / 009 remain active (no regress)", () => {
    const rows = loadChecklistRows();
    for (const id of STAY_ACTIVE) {
      expect(byId(rows, id).status, `${id} must stay active`).toBe("active");
    }
  });
});
