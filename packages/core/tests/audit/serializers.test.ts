/**
 * Core JSON / SARIF serializers via public API (p6b).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  exitCodeOf,
  getFormatAuditCiJson,
  getFormatAuditCiSarif,
  getRunAuditCi,
  writeCleanLocalProject,
  writeMissingTreeProject,
  writeTamperedHashProject,
  type TempProject,
} from "./helpers.ts";

describe("p6b core audit serializers", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("formatAuditCiJson emits CIAuditResult shape with summary on clean gate", async () => {
    project = createTempProject();
    writeCleanLocalProject(project.cwd, "p6b-json-clean");

    const result = await getRunAuditCi()({ cwd: project.cwd, ci: true });
    expect(exitCodeOf(result)).toBe(0);

    const body = getFormatAuditCiJson()(result);
    expect(body).toMatch(/^\s*\{/);
    expect(body).not.toMatch(/Audit CI clean/i);

    const doc = JSON.parse(body) as Record<string, unknown>;
    expect(doc.passed).toBe(true);
    expect(Array.isArray(doc.checks)).toBe(true);
    expect((doc.checks as unknown[]).length).toBe(3);
    const summary = doc.summary as Record<string, unknown>;
    expect(summary).toBeTruthy();
    expect(summary.total).toBe(3);
    expect(summary.passed).toBe(3);
    expect(summary.failed).toBe(0);

    // Pretty indent 2 SHOULD: second line starts with two spaces before a key
    const lines = body.split("\n");
    expect(lines.length).toBeGreaterThan(2);
    expect(lines[1]).toMatch(/^ {2}"/);
  });

  test("formatAuditCiJson on failure has passed:false and failed checks", async () => {
    project = createTempProject();
    writeTamperedHashProject(project.cwd, "p6b-json-fail");

    const result = await getRunAuditCi()({ cwd: project.cwd, ci: true });
    expect(exitCodeOf(result)).toBe(1);

    const doc = JSON.parse(getFormatAuditCiJson()(result)) as Record<string, unknown>;
    expect(doc.passed).toBe(false);
    const summary = doc.summary as Record<string, unknown>;
    expect(Number(summary.failed)).toBeGreaterThan(0);
    const checks = doc.checks as Array<Record<string, unknown>>;
    expect(checks.some((c) => c.passed === false)).toBe(true);
    const content = checks.find((c) => c.name === "content-integrity");
    expect(content?.passed).toBe(false);
  });

  test("formatAuditCiSarif clean: 2.1.0, driver bapm-audit, empty error results", async () => {
    project = createTempProject();
    writeCleanLocalProject(project.cwd, "p6b-sarif-clean");

    const result = await getRunAuditCi()({ cwd: project.cwd, ci: true });
    expect(exitCodeOf(result)).toBe(0);

    const body = getFormatAuditCiSarif()(result);
    const doc = JSON.parse(body) as Record<string, unknown>;
    expect(doc.version).toBe("2.1.0");
    expect(String(doc.$schema ?? "")).toMatch(/sarif/i);

    const runs = doc.runs as Array<Record<string, unknown>>;
    expect(runs).toHaveLength(1);
    const tool = runs[0]!.tool as Record<string, unknown>;
    const driver = tool.driver as Record<string, unknown>;
    expect(driver.name).toBe("bapm-audit");

    const results = (runs[0]!.results as unknown[] | undefined) ?? [];
    const errors = results.filter((r) => {
      const level = String((r as Record<string, unknown>).level ?? "");
      return level === "error";
    });
    expect(errors).toHaveLength(0);
  });

  test("formatAuditCiSarif failure emits error results without snippets", async () => {
    project = createTempProject();
    writeMissingTreeProject(project.cwd, "p6b-sarif-fail");

    const result = await getRunAuditCi()({ cwd: project.cwd, ci: true });
    expect(exitCodeOf(result)).not.toBe(0);

    const body = getFormatAuditCiSarif()(result);
    expect(body).not.toMatch(/"snippet"\s*:/);
    expect(body).not.toMatch(/"region"\s*:\s*\{[^}]*"snippet"/);

    const doc = JSON.parse(body) as Record<string, unknown>;
    const runs = doc.runs as Array<Record<string, unknown>>;
    const results = runs[0]!.results as Array<Record<string, unknown>>;
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.level === "error")).toBe(true);
    expect(
      results.some(
        (r) => r.ruleId === "tree-sha256" || r.ruleId === "content-integrity",
      ),
    ).toBe(true);
  });
});
