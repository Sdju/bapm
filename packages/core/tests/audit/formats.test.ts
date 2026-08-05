/**
 * Unit: structured audit checks + serializers (p6b).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import {
  formatAuditCiJson,
  formatAuditCiSarif,
  runAuditCi,
} from "../../src/modules/Audit/index.ts";

function sha256Hex(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

describe("Audit structured formats (unit)", () => {
  let cwd: string;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
  });

  test("clean → three passing checks + json passed:true", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-audit-unit-"));
    const rel = ".agents/skills/hello/SKILL.md";
    const content = "ok\n";
    writeText(join(cwd, "bapm.yml"), `name: u\nversion: 0.0.1\ndependencies:\n  apm: []\n`);
    writeText(join(cwd, rel), content);
    writeText(
      join(cwd, "bapm.lock.yaml"),
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n    deployed_file_hashes:\n      "${rel}": "${sha256Hex(content)}"\n`,
    );

    const result = await runAuditCi({ cwd, ci: true });
    expect(result.exitCode).toBe(0);
    expect(result.checks.map((c) => c.name)).toEqual([
      "lockfile-exists",
      "content-integrity",
      "tree-sha256",
    ]);
    expect(result.checks.every((c) => c.passed)).toBe(true);

    const doc = JSON.parse(formatAuditCiJson(result)) as { passed: boolean };
    expect(doc.passed).toBe(true);
  });

  test("sarif skeleton on clean has no error results", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-audit-unit-"));
    writeText(join(cwd, "bapm.yml"), `name: u\nversion: 0.0.1\ndependencies:\n  apm: []\n`);
    writeText(
      join(cwd, "bapm.lock.yaml"),
      `lockfile_version: "1"\ndependencies: []\n`,
    );

    const result = await runAuditCi({ cwd, ci: true });
    const doc = JSON.parse(formatAuditCiSarif(result)) as {
      version: string;
      runs: Array<{ tool: { driver: { name: string } }; results: unknown[] }>;
    };
    expect(doc.version).toBe("2.1.0");
    expect(doc.runs[0]!.tool.driver.name).toBe("bapm-audit");
    expect(doc.runs[0]!.results).toEqual([]);
  });
});
