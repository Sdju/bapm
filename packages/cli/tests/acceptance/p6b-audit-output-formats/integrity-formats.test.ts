/**
 * p6b — structured formats MUST NOT soften lk-015 / lk-017 exit contract.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  runInProject,
  stdoutText,
  writeCleanAuditProject,
  writeMissingTreeAuditProject,
  writeTamperedAuditProject,
  type TempProject,
} from "./helpers.ts";

describe("p6b CLI audit integrity exit across formats", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("text mode unchanged on clean inventory", async () => {
    project = createTempProject();
    writeCleanAuditProject(project.cwd, "p6b-text-clean");

    const { result, combined } = await runInProject(project.cwd, ["audit", "--ci"]);
    expectKnownCommand(combined, "audit");
    expect(result).toBe(0);
  });

  test("json format still fails on tampered deployed file (lk-017)", async () => {
    project = createTempProject();
    writeTamperedAuditProject(project.cwd, "p6b-json-tamper");

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "audit",
      "--ci",
      "-f",
      "json",
    ]);
    expectKnownCommand(combined, "audit");
    expect(result).toBe(1);
    const doc = JSON.parse(stdoutText(stdout).trim()) as Record<string, unknown>;
    expect(doc.passed).toBe(false);
  });

  test("sarif format still fails on missing tree_sha256 (lk-015)", async () => {
    project = createTempProject();
    writeMissingTreeAuditProject(project.cwd, "p6b-sarif-tree");

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "audit",
      "--ci",
      "-f",
      "sarif",
    ]);
    expectKnownCommand(combined, "audit");
    expect(result).not.toBe(0);
    const doc = JSON.parse(stdoutText(stdout).trim()) as Record<string, unknown>;
    const runs = doc.runs as Array<Record<string, unknown>>;
    const results = (runs[0]!.results as Array<Record<string, unknown>>) ?? [];
    expect(results.some((r) => r.ruleId === "tree-sha256" && r.level === "error")).toBe(true);
  });

  test("format does not flip exit vs text on the same failing fixture", async () => {
    project = createTempProject();
    writeTamperedAuditProject(project.cwd, "p6b-exit-parity");

    const textRun = await runInProject(project.cwd, ["audit", "--ci", "-f", "text"]);
    const jsonRun = await runInProject(project.cwd, ["audit", "--ci", "-f", "json"]);

    expectKnownCommand(textRun.combined, "audit");
    expectKnownCommand(jsonRun.combined, "audit");
    expect(textRun.result).toBe(1);
    expect(jsonRun.result).toBe(1);
    // Prove text path ran the gate (human/diagnostic output), json path emitted structured body
    expect(textRun.combined).toMatch(/hash|mismatch|expected|observed|SKILL|integrity/i);
    const doc = JSON.parse(stdoutText(jsonRun.stdout).trim()) as Record<string, unknown>;
    expect(doc.passed).toBe(false);
  });
});
