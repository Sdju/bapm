/**
 * sc-* status honesty: active sc-* keep resolvable citations; residual skipped
 * after sc-host-class claim flip (soft zip req-sc-004 only).
 */
import { expect, test, describe } from "vite-plus/test";
import {
  ACTIVE_SC_IDS,
  SKIPPED_SC_IDS,
  byId,
  checklistPath,
  checklistRows,
  citationPaths,
  loadChecklist,
  pathExistsInRepo,
} from "./sc-claims-helpers.ts";
import { existsSync } from "node:fs";

describe("sc-* status honesty", () => {
  test("Mode B checklist.yml is present", () => {
    expect(existsSync(checklistPath), `expected ${checklistPath}`).toBe(true);
  });

  test("active sc-* remain active with non-empty citations that resolve", () => {
    const rows = checklistRows(loadChecklist());

    for (const id of ACTIVE_SC_IDS) {
      const row = byId(rows, id);
      expect(row.status, `${id} must stay active`).toBe("active");

      const citation = String(row.citation ?? "").trim();
      expect(citation.length, `${id} needs a citation`).toBeGreaterThan(0);

      const paths = citationPaths(citation);
      expect(paths.length, `${id} citation should name at least one file`).toBeGreaterThan(0);
      for (const rel of paths) {
        expect(pathExistsInRepo(rel), `${id} citation path missing on disk: ${rel}`).toBe(true);
      }
    }
  });

  test("residual honesty-floor sc-* stay skipped (no false actives)", () => {
    const rows = checklistRows(loadChecklist());

    for (const id of SKIPPED_SC_IDS) {
      const row = byId(rows, id);
      expect(row.status, `${id} must remain skipped`).toBe("skipped");
      expect(row.status).not.toBe("active");
    }
  });

  test("no unexpected active among residual claim-list candidates", () => {
    const rows = checklistRows(loadChecklist());
    const falseActives = SKIPPED_SC_IDS.filter((id) => byId(rows, id).status === "active");
    expect(
      falseActives,
      `false actives forbidden without Mode B citations: ${falseActives.join(", ")}`,
    ).toEqual([]);
  });
});
