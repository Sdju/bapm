/**
 * G9 — Mode B claim set for req-sc-010/011/012 (implement-then-claim).
 */
import { describe, expect, test } from "vite-plus/test";
import { existsSync } from "node:fs";
import {
  byId,
  checklistPath,
  citationPaths,
  loadChecklistRows,
  pathExistsInRepo,
} from "./helpers.ts";

const CLAIM_ACTIVE = ["req-sc-010", "req-sc-011", "req-sc-012"] as const;
const STAY_SKIPPED = [
  "req-sc-003",
  "req-sc-004",
  "req-sc-005",
  "req-sc-008",
  "req-sc-013",
] as const;
const STAY_ACTIVE = [
  "req-sc-001",
  "req-sc-002",
  "req-sc-006",
  "req-sc-007",
  "req-sc-009",
] as const;

describe("sc-executable-governance Mode B claim set (G9)", () => {
  test("Mode B checklist.yml is present", () => {
    expect(existsSync(checklistPath), `expected ${checklistPath}`).toBe(true);
  });

  test("req-sc-010 / 011 / 012 are active with sc-executable-governance citations", () => {
    const rows = loadChecklistRows();
    for (const id of CLAIM_ACTIVE) {
      const row = byId(rows, id);
      expect(row.status, `${id} must be active after sc-executable-governance`).toBe("active");
      const citation = String(row.citation ?? "").trim();
      expect(citation.length, `${id} needs Mode B citation`).toBeGreaterThan(0);
      expect(citation).toMatch(/sc-executable-governance/);
      const paths = citationPaths(citation);
      expect(paths.length, `${id} citation should name at least one file`).toBeGreaterThan(0);
      for (const rel of paths) {
        expect(pathExistsInRepo(rel), `${id} citation path missing: ${rel}`).toBe(true);
      }
    }
  });

  test("host-class / soft skips stay skipped (003/004/005/008/013)", () => {
    const rows = loadChecklistRows();
    for (const id of STAY_SKIPPED) {
      expect(byId(rows, id).status, `${id} must remain skipped`).toBe("skipped");
    }
  });

  test("prior actives 001/002/006/007/009 remain active", () => {
    const rows = loadChecklistRows();
    for (const id of STAY_ACTIVE) {
      const row = byId(rows, id);
      expect(row.status, `${id} must stay active`).toBe("active");
      expect(String(row.citation ?? "").trim().length).toBeGreaterThan(0);
    }
  });
});
