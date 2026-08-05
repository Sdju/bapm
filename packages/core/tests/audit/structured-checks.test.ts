/**
 * Structured CI check taxonomy (lockfile-exists → content-integrity → tree-sha256).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import {
  checkNames,
  checksOf,
  createTempProject,
  exitCodeOf,
  getRunAuditCi,
  writeCleanLocalProject,
  writeMissingTreeProject,
  writeTamperedHashProject,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("p6b core structured audit checks", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("clean gate yields three passing checks in fixed order", async () => {
    project = createTempProject();
    writeCleanLocalProject(project.cwd, "p6b-clean");

    const result = await getRunAuditCi()({ cwd: project.cwd, ci: true });
    expect(exitCodeOf(result)).toBe(0);

    const checks = checksOf(result);
    expect(checks).toHaveLength(3);
    expect(checkNames(checks)).toEqual([
      "lockfile-exists",
      "content-integrity",
      "tree-sha256",
    ]);
    for (const check of checks) {
      expect(check.passed).toBe(true);
      expect(typeof check.message).toBe("string");
      expect(Array.isArray(check.details)).toBe(true);
      expect(check.details as unknown[]).toEqual([]);
    }

    const r = result as Record<string, unknown>;
    expect(r.ok).toBe(true);
    // Overall structured passed may be on result or derived — accept either shape
    if ("passed" in r) expect(r.passed).toBe(true);
  });

  test("missing lock fails lockfile-exists; later checks present and not evaluated", async () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.yml"),
      `name: p6b-nolock\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );

    const result = await getRunAuditCi()({ cwd: project.cwd, ci: true });
    expect(exitCodeOf(result)).not.toBe(0);

    const checks = checksOf(result);
    expect(checks).toHaveLength(3);
    expect(checkNames(checks)).toEqual([
      "lockfile-exists",
      "content-integrity",
      "tree-sha256",
    ]);
    expect(checks[0]!.passed).toBe(false);
    expect(checks[1]!.passed).toBe(false);
    expect(checks[2]!.passed).toBe(false);
    const laterMsg = `${String(checks[1]!.message)}\n${String(checks[2]!.message)}`;
    expect(laterMsg).toMatch(/not evaluated|lockfile missing|no lock/i);
    expect(checks[1]!.details as unknown[]).toEqual([]);
    expect(checks[2]!.details as unknown[]).toEqual([]);
  });

  test("hash mismatch fails only content-integrity among integrity categories", async () => {
    project = createTempProject();
    const { rel } = writeTamperedHashProject(project.cwd, "p6b-tamper");

    const result = await getRunAuditCi()({ cwd: project.cwd, ci: true });
    expect(exitCodeOf(result)).toBe(1);

    const checks = checksOf(result);
    expect(checkNames(checks)).toEqual([
      "lockfile-exists",
      "content-integrity",
      "tree-sha256",
    ]);
    expect(checks[0]!.passed).toBe(true);
    expect(checks[1]!.passed).toBe(false);
    expect(checks[2]!.passed).toBe(true);
    const details = (checks[1]!.details as unknown[]).map(String).join("\n");
    expect(details.length).toBeGreaterThan(0);
    expect(details).toMatch(new RegExp(rel.replace(/\./g, "\\.") + "|SKILL\\.md|hello", "i"));
  });

  test("missing tree_sha256 fails tree-sha256 with entry detail", async () => {
    project = createTempProject();
    writeMissingTreeProject(project.cwd, "p6b-no-tree");

    const result = await getRunAuditCi()({ cwd: project.cwd, ci: true });
    expect(exitCodeOf(result)).not.toBe(0);

    const checks = checksOf(result);
    expect(checkNames(checks)).toEqual([
      "lockfile-exists",
      "content-integrity",
      "tree-sha256",
    ]);
    expect(checks[0]!.passed).toBe(true);
    expect(checks[1]!.passed).toBe(true);
    expect(checks[2]!.passed).toBe(false);
    const blob = [
      String(checks[2]!.message),
      ...(checks[2]!.details as unknown[]).map(String),
    ].join("\n");
    expect(blob).toMatch(/git-pkg|tree_sha256|tree-sha256/i);
  });
});
