/**
 * CLI --format / --output flags and help (p6b).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  existsSync,
  join,
  readFileSync,
  readLockBytes,
  runInProject,
  stdoutText,
  writeCleanAuditProject,
  type TempProject,
} from "./helpers.ts";

describe("p6b CLI audit format flags", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("-f json on clean fixture exits 0 with passed:true JSON", async () => {
    project = createTempProject();
    writeCleanAuditProject(project.cwd, "p6b-cli-json");

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "audit",
      "--ci",
      "-f",
      "json",
    ]);
    expectKnownCommand(combined, "audit");
    expect(result).toBe(0);
    const body = stdoutText(stdout).trim();
    const doc = JSON.parse(body) as Record<string, unknown>;
    expect(doc.passed).toBe(true);
    expect(Array.isArray(doc.checks)).toBe(true);
    expect(doc.summary).toBeTruthy();
  });

  test("unknown -f fails closed and does not write report file", async () => {
    project = createTempProject();
    writeCleanAuditProject(project.cwd, "p6b-cli-badfmt");
    const outFile = join(project.cwd, "reports", "out.json");

    const { result, combined } = await runInProject(project.cwd, [
      "audit",
      "--ci",
      "-f",
      "xml",
      "-o",
      outFile,
    ]);
    expectKnownCommand(combined, "audit");
    expect(result).not.toBe(0);
    expect(existsSync(outFile)).toBe(false);
    expect(combined).toMatch(/format|xml|unsupported|unknown/i);
  });

  test("-o with .sarif extension auto-detects when -f omitted", async () => {
    project = createTempProject();
    writeCleanAuditProject(project.cwd, "p6b-cli-sarif-ext");
    const outFile = join(project.cwd, "out.sarif");

    const { result, combined } = await runInProject(project.cwd, ["audit", "--ci", "-o", outFile]);
    expectKnownCommand(combined, "audit");
    expect(result).toBe(0);
    expect(existsSync(outFile)).toBe(true);
    const doc = JSON.parse(readFileSync(outFile, "utf8")) as Record<string, unknown>;
    expect(doc.version).toBe("2.1.0");
    const runs = doc.runs as Array<Record<string, unknown>>;
    const driver = (runs[0]!.tool as Record<string, unknown>).driver as Record<string, unknown>;
    expect(driver.name).toBe("bapm-audit");
  });

  test("explicit -f json wins over .sarif extension", async () => {
    project = createTempProject();
    writeCleanAuditProject(project.cwd, "p6b-cli-f-wins");
    const outFile = join(project.cwd, "out.sarif");

    const { result, combined } = await runInProject(project.cwd, [
      "audit",
      "--ci",
      "-f",
      "json",
      "-o",
      outFile,
    ]);
    expectKnownCommand(combined, "audit");
    expect(result).toBe(0);
    const doc = JSON.parse(readFileSync(outFile, "utf8")) as Record<string, unknown>;
    expect(doc.passed).toBe(true);
    expect(Array.isArray(doc.checks)).toBe(true);
    expect(doc.summary).toBeTruthy();
    expect(doc.version).not.toBe("2.1.0");
  });

  test("audit help mentions --ci, -f text|json|sarif, and -o", async () => {
    project = createTempProject();
    writeCleanAuditProject(project.cwd, "p6b-cli-help");

    const { result, stdout, combined } = await runInProject(project.cwd, ["audit", "--help"]);
    expectKnownCommand(combined, "audit");
    expect(result).toBe(0);
    const help = stdoutText(stdout);
    expect(help).toMatch(/--ci/);
    expect(help).toMatch(/-f|--format/);
    expect(help).toMatch(/text/);
    expect(help).toMatch(/json/);
    expect(help).toMatch(/sarif/i);
    expect(help).toMatch(/-o|--output/);
  });

  test("json to stdout is body-only (no human banner)", async () => {
    project = createTempProject();
    writeCleanAuditProject(project.cwd, "p6b-cli-body");

    const { result, stdout } = await runInProject(project.cwd, ["audit", "--ci", "-f", "json"]);
    expect(result).toBe(0);
    const body = stdoutText(stdout).trim();
    expect(body.startsWith("{")).toBe(true);
    expect(body.endsWith("}")).toBe(true);
    expect(body).not.toMatch(/Audit CI clean/i);
    const doc = JSON.parse(body) as Record<string, unknown>;
    expect(doc.passed).toBe(true);
    expect(Array.isArray(doc.checks)).toBe(true);
  });

  test("-o writes file, keeps stdout clear of body, lock unchanged", async () => {
    project = createTempProject();
    writeCleanAuditProject(project.cwd, "p6b-cli-outfile");
    const before = readLockBytes(project.cwd);
    const outFile = join(project.cwd, "nested", "report.json");

    const { result, stdout, stderr, combined } = await runInProject(project.cwd, [
      "audit",
      "--ci",
      "-f",
      "json",
      "-o",
      outFile,
    ]);
    expectKnownCommand(combined, "audit");
    expect(result).toBe(0);
    expect(existsSync(outFile)).toBe(true);
    const fileDoc = JSON.parse(readFileSync(outFile, "utf8")) as Record<string, unknown>;
    expect(fileDoc.passed).toBe(true);
    const out = stdoutText(stdout).trim();
    expect(out.includes('"passed"') || out.includes('"checks"')).toBe(false);
    expect(stderr.join("\n").length).toBeGreaterThan(0);
    expect(Buffer.compare(readLockBytes(project.cwd), before)).toBe(0);
  });
});
