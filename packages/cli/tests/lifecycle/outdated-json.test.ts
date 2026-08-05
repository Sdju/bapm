/**
 * CLI outdated --json shape { dependencies: OutdatedRow[] } (SHOULD).
 * Suppress human table; no invented APM source; -v includes tip_ref/detail when present.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  expectKnownOutdatedFlag,
  parseJsonStdout,
  runInProject,
  stdoutText,
  writeLeafLock,
  writeLeafProject,
  type TempProject,
} from "./helpers.ts";

const OUTDATED_ROW_KEYS = new Set([
  "name",
  "status",
  "current",
  "latest",
  "repo_url",
  "tip_ref",
  "detail",
]);

describe("CLI outdated --json", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("--json emits { dependencies: OutdatedRow[] } without human table or invented source", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7b-cli-json");
    writeLeafLock(project.cwd);

    const { result, stdout, stderr, combined } = await runInProject(project.cwd, [
      "outdated",
      "--json",
    ]);
    expectKnownCommand(combined, "outdated");
    expectKnownOutdatedFlag(combined, "--json");
    expect(result).toBe(0);

    const doc = parseJsonStdout(stdout) as Record<string, unknown>;
    expect(doc).toHaveProperty("dependencies");
    expect(Array.isArray(doc.dependencies)).toBe(true);
    const rows = doc.dependencies as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      expect(typeof row.name).toBe("string");
      expect(typeof row.status).toBe("string");
      expect(row).not.toHaveProperty("source");
      for (const key of Object.keys(row)) {
        expect(OUTDATED_ROW_KEYS.has(key)).toBe(true);
      }
      // Absent optionals must be omitted (not null placeholders).
      for (const key of ["current", "latest", "repo_url", "tip_ref", "detail"] as const) {
        if (key in row) expect(row[key]).not.toBeNull();
      }
    }

    const raw = stdoutText(stdout);
    expect(raw).not.toMatch(/^All dependencies are up-to-date$/m);
    expect(raw).not.toMatch(/\tleaf\toutdated\t|\tleaf\tup-to-date\t/);
    // Success JSON must not land on stderr.
    expect(stderr.join("\n")).not.toMatch(/"dependencies"\s*:/);
  });

  test("-v --json includes present tip_ref/detail; JSON wins over human text", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7b-cli-json-v");
    writeLeafLock(project.cwd);

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "outdated",
      "-v",
      "--json",
    ]);
    expectKnownCommand(combined, "outdated");
    expectKnownOutdatedFlag(combined, "--json");
    expect(result).toBe(0);

    const doc = parseJsonStdout(stdout) as {
      dependencies: Array<Record<string, unknown>>;
    };
    expect(Array.isArray(doc.dependencies)).toBe(true);
    const leaf = doc.dependencies.find((r) => String(r.name) === "leaf");
    expect(leaf).toBeTruthy();
    // Local skip under -v populates detail on the row.
    expect(typeof leaf!.detail).toBe("string");
    expect(String(leaf!.detail).length).toBeGreaterThan(0);
    expect(leaf!).not.toHaveProperty("source");

    // Entire stdout is JSON only (pretty-printed ok).
    expect(() => JSON.parse(stdoutText(stdout).trim())).not.toThrow();
  });

  test("--json combines with -j", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7b-cli-json-j");
    writeLeafLock(project.cwd);

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "outdated",
      "--json",
      "-j",
      "2",
    ]);
    expectKnownCommand(combined, "outdated");
    expectKnownOutdatedFlag(combined, "--json");
    expectKnownOutdatedFlag(combined, "-j");
    expect(result).toBe(0);
    const doc = parseJsonStdout(stdout) as Record<string, unknown>;
    expect(Array.isArray(doc.dependencies)).toBe(true);
  });
});
