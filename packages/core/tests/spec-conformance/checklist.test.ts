/**
 * p3: informative requirements mirror + Mode B checklist (active|skipped|n/a).
 */
import { expect, test, describe } from "vite-plus/test";
import { existsSync } from "node:fs";
import {
  checklistCandidates,
  checklistRows,
  findExistingPath,
  loadJsonFile,
  loadYamlFile,
  requirementsMirrorPath,
  specConformanceDir,
} from "./helpers.ts";

const ALLOWED_STATUS = new Set(["active", "skipped", "n/a", "na"]);

describe("p3 Mode B — requirements mirror + checklist", () => {
  test("openapm-v0.1.requirements.yml is vendored under tests/spec-conformance/", () => {
    expect(
      existsSync(requirementsMirrorPath),
      `expected requirements mirror at ${requirementsMirrorPath}`,
    ).toBe(true);

    const doc = loadYamlFile(requirementsMirrorPath) as {
      requirements?: unknown[];
      spec_version?: string;
    };
    expect(Array.isArray(doc.requirements)).toBe(true);
    expect(doc.requirements!.length).toBeGreaterThanOrEqual(100);
    expect(String(doc.spec_version ?? "")).toMatch(/0\.1/);
  });

  test("machine checklist enumerates reqs with status active|skipped|n/a", () => {
    expect(
      existsSync(specConformanceDir),
      `expected ${specConformanceDir}`,
    ).toBe(true);

    const path = findExistingPath(checklistCandidates);
    expect(
      path,
      `expected checklist at one of: ${checklistCandidates.join(", ")}`,
    ).toBeTruthy();

    const raw = path!.endsWith(".json") ? loadJsonFile(path!) : loadYamlFile(path!);
    const rows = checklistRows(raw);
    expect(rows.length).toBeGreaterThanOrEqual(100);

    for (const row of rows) {
      expect(row.id, "checklist row needs req id").toMatch(/^req-/);
      expect(
        ALLOWED_STATUS.has(row.status),
        `${row.id} status="${row.status}" must be active|skipped|n/a`,
      ).toBe(true);
    }
  });

  test("Registry rg-001 is n/a; Governance pl-003/011/012 may be active when claimed", () => {
    const path = findExistingPath(checklistCandidates);
    expect(path, "checklist required").toBeTruthy();
    const rows = checklistRows(
      path!.endsWith(".json") ? loadJsonFile(path!) : loadYamlFile(path!),
    );
    byId(rows, "req-rg-001");

    const rg = byId(rows, "req-rg-001");
    expect(["n/a", "na", "skipped"]).toContain(rg.status);
    expect(rg.status).not.toBe("active");

    const plExtends = rows.filter((r) => /^req-pl-/.test(r.id));
    expect(plExtends.length).toBeGreaterThan(0);

    // When Governance is claimed, pl-003/011/012 must be active with citations (not skipped as P4 deferred).
    for (const id of ["req-pl-003", "req-pl-011", "req-pl-012"] as const) {
      const row = byId(rows, id);
      if (row.status === "skipped") {
        expect(String(row.rationale ?? "")).toMatch(/P4|deferred|floor/i);
      } else {
        expect(row.status).toBe("active");
        expect(String(row.citation ?? row.fixture ?? "").length).toBeGreaterThan(0);
        expect(String(row.rationale ?? "")).not.toMatch(/P4 deferred/i);
      }
    }
  });

  test("every active row cites fixture path and/or assertion", () => {
    const path = findExistingPath(checklistCandidates);
    expect(path, "checklist required").toBeTruthy();
    const rows = checklistRows(
      path!.endsWith(".json") ? loadJsonFile(path!) : loadYamlFile(path!),
    );

    const active = rows.filter((r) => r.status === "active");
    expect(active.length).toBeGreaterThan(0);

    for (const row of active) {
      const hasFixture =
        (typeof row.fixture === "string" && row.fixture.length > 0) ||
        (Array.isArray(row.fixture) && row.fixture.length > 0);
      const hasCitation = Boolean(
        (row.assertion && row.assertion.length > 0) ||
          (row.citation && row.citation.length > 0) ||
          (typeof row.tests === "string" && row.tests.length > 0) ||
          (Array.isArray(row.tests) && row.tests.length > 0),
      );
      expect(
        hasFixture || hasCitation,
        `${row.id} active without fixture path or assertion citation`,
      ).toBe(true);
    }
  });
});

function byId(rows: ReturnType<typeof checklistRows>, id: string) {
  const row = rows.find((r) => r.id === id);
  expect(row, `checklist must include ${id}`).toBeTruthy();
  return row!;
}
