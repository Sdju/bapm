/**
 * Mode B: claim req-mf-024 with citations; req-mf-022 cites empty-subset diagnostic.
 */
import { describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checklistCandidates,
  checklistRows,
  conformanceJsonPath,
  conformanceMdPath,
  findExistingPath,
  loadJsonFile,
  loadYamlFile,
  repoRoot,
} from "./helpers.ts";
import { byId, citationPaths, pathExistsInRepo } from "./sc-claims-helpers.ts";

const EMPTY_SUBSET_CITE =
  /empty.?skill|skill.?subset|stale skill|gone|req-mf-022|deps-object-subset-install/i;
const IDENTITY_CITE =
  /mf-024|id:|registry.?to.?git|object-form|deps-object-subset-identity|serialize/i;

function loadRows() {
  const path = findExistingPath(checklistCandidates);
  expect(
    path,
    `expected Mode B checklist at one of: ${checklistCandidates.join(", ")}`,
  ).toBeTruthy();
  const raw = path!.endsWith(".json") ? loadJsonFile(path!) : loadYamlFile(path!);
  return checklistRows(raw);
}

function citationBlob(row: { citation?: string; assertion?: string; fixture?: unknown }): string {
  const fixture = Array.isArray(row.fixture)
    ? row.fixture.join(" ")
    : row.fixture != null
      ? String(row.fixture)
      : "";
  return `${row.citation ?? ""}\n${row.assertion ?? ""}\n${fixture}`;
}

describe("Mode B req-mf-024 / req-mf-022 after subset-identity slice", () => {
  test("req-mf-024 is active with non-empty citations that resolve on disk", () => {
    const row = byId(loadRows(), "req-mf-024");
    expect(row.status).toBe("active");
    const citation = String(row.citation ?? "").trim();
    expect(citation.length).toBeGreaterThan(0);
    const paths = citationPaths(citation);
    expect(paths.length, "req-mf-024 needs at least one citation path").toBeGreaterThan(0);
    for (const rel of paths) {
      const token = rel.split(/\s+/)[0] ?? rel;
      if (!/\.(ts|md|yml|yaml|json)$/i.test(token)) continue;
      expect(pathExistsInRepo(token), `req-mf-024 citation missing on disk: ${token}`).toBe(true);
    }
    expect(citationBlob(row)).toMatch(IDENTITY_CITE);
  });

  test("CONFORMANCE.md and CONFORMANCE.json mark req-mf-024 active", () => {
    expect(existsSync(conformanceMdPath)).toBe(true);
    expect(existsSync(conformanceJsonPath)).toBe(true);
    const md = readFileSync(conformanceMdPath, "utf8");
    expect(md).toMatch(/req-mf-024/);
    expect(md).toMatch(/req-mf-024[^\n]*active/i);
    const json = loadJsonFile(conformanceJsonPath) as {
      requirements?: Array<{ id?: string; status?: string }>;
    };
    const rows = Array.isArray(json.requirements) ? json.requirements : [];
    const row = rows.find((r) => r.id === "req-mf-024");
    expect(row, "CONFORMANCE.json missing req-mf-024").toBeTruthy();
    expect(row!.status).toBe("active");
  });

  test("req-mf-022 stays active and cites the empty skill-subset diagnostic", () => {
    const row = byId(loadRows(), "req-mf-022");
    expect(row.status).toBe("active");
    const blob = citationBlob(row);
    expect(blob).toMatch(EMPTY_SUBSET_CITE);
    const paths = citationPaths(String(row.citation ?? ""));
    expect(paths.some((p) => pathExistsInRepo(p.split(/\s+/)[0] ?? p))).toBe(true);
  });

  test("checklist citation files for this slice live under the repo", () => {
    const expected = join(
      repoRoot,
      "packages/core/tests/manifest/deps-object-subset-identity.test.ts",
    );
    expect(existsSync(expected)).toBe(true);
  });
});
