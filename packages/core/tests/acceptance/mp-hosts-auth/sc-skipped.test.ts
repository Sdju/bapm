/**
 * Strategy A — sc-003/005/008/013 stay skipped after thin hosts-auth (no false actives).
 */
import { describe, expect, test } from "vite-plus/test";
import { existsSync } from "node:fs";
import {
  HOSTS_AUTH_SKIPPED_SC,
  byId,
  checklistPath,
  loadChecklistRows,
} from "./helpers.ts";

describe("mp-hosts-auth CONFORMANCE honesty (Strategy A)", () => {
  test("Mode B checklist.yml is present", () => {
    expect(existsSync(checklistPath), `expected ${checklistPath}`).toBe(true);
  });

  test("req-sc-003 / 005 / 008 / 013 remain skipped (thin expand does not claim §10.3)", () => {
    const rows = loadChecklistRows();
    for (const id of HOSTS_AUTH_SKIPPED_SC) {
      const row = byId(rows, id);
      expect(row.status, `${id} must remain skipped under Strategy A`).toBe("skipped");
      expect(row.status).not.toBe("active");
    }
  });

  test("no false actives among hosts-auth sc claim IDs", () => {
    const rows = loadChecklistRows();
    const falseActives = HOSTS_AUTH_SKIPPED_SC.filter(
      (id) => byId(rows, id).status === "active",
    );
    expect(
      falseActives,
      `false actives forbidden without Mode B claim path: ${falseActives.join(", ")}`,
    ).toEqual([]);
  });
});
