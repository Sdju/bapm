/**
 * p6c-lock-parity — lock-command: `bapm lock export` SBOM IO.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  listFilesRecursive,
  lockPath,
  readLockBytes,
  runInProject,
  stdoutText,
  writeLeafProject,
  writeSampleLock,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("p6c CLI lock export", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
    delete process.env.SOURCE_DATE_EPOCH;
  });

  test("default export writes CycloneDX 1.5 JSON to stdout only", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6c-export-cdx");
    writeSampleLock(project.cwd);
    const before = readLockBytes(project.cwd);

    const { result, stdout, stderr } = await runInProject(project.cwd, [
      "lock",
      "export",
      "--timestamp",
      "2020-01-01T00:00:00Z",
    ]);

    expect(result).toBe(0);
    const body = stdoutText(stdout).trim();
    expect(body.length).toBeGreaterThan(0);
    const doc = JSON.parse(body) as Record<string, unknown>;
    expect(doc.bomFormat).toBe("CycloneDX");
    expect(String(doc.specVersion)).toBe("1.5");
    expect(stderr.join("\n")).not.toMatch(/^\s*\{/);
    expect(Buffer.compare(readLockBytes(project.cwd), before)).toBe(0);
  });

  test("SPDX format with -o writes file; stdout has no SBOM body", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6c-export-spdx");
    writeSampleLock(project.cwd);
    const outFile = join(project.cwd, "sbom.json");

    const { result, stdout } = await runInProject(project.cwd, [
      "lock",
      "export",
      "-f",
      "spdx",
      "-o",
      outFile,
      "--timestamp",
      "2020-01-01T00:00:00Z",
    ]);

    expect(result).toBe(0);
    expect(existsSync(outFile)).toBe(true);
    const fileBody = readFileSync(outFile, "utf8");
    const doc = JSON.parse(fileBody) as Record<string, unknown>;
    const spdxVersion = String(doc.spdxVersion ?? doc.SPDXVersion ?? "");
    expect(spdxVersion).toMatch(/SPDX-2\.3/i);
    const stdoutJoined = stdoutText(stdout).trim();
    // SBOM must not be on stdout when -o is used
    expect(stdoutJoined.includes("spdxVersion") || stdoutJoined.includes("SPDXVersion")).toBe(
      false,
    );
  });

  test("missing lock fails with empty stdout and explanatory stderr", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6c-export-missing");
    expect(lockPath(project.cwd)).toBeUndefined();

    const { result, stdout, stderr } = await runInProject(project.cwd, ["lock", "export"]);

    expect(result).not.toBe(0);
    expect(stdoutText(stdout).trim()).toBe("");
    expect(stderr.join("\n")).toMatch(/lock/i);
  });

  test("unknown export format fails closed (no SBOM on stdout)", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6c-export-badfmt");
    writeSampleLock(project.cwd);

    const { result, stdout } = await runInProject(project.cwd, [
      "lock",
      "export",
      "--format",
      "not-a-format",
    ]);

    expect(result).not.toBe(0);
    const body = stdoutText(stdout).trim();
    expect(body).not.toMatch(/"bomFormat"\s*:\s*"CycloneDX"/);
    expect(body).not.toMatch(/"spdxVersion"\s*:/);
  });

  test("repeated export with pinned timestamp is byte-identical", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6c-export-det");
    writeSampleLock(project.cwd);
    const argv = ["lock", "export", "--timestamp", "2019-05-05T05:05:05Z"];

    const first = await runInProject(project.cwd, argv);
    const second = await runInProject(project.cwd, argv);

    expect(first.result).toBe(0);
    expect(second.result).toBe(0);
    const a = stdoutText(first.stdout).trim();
    const b = stdoutText(second.stdout).trim();
    expect(JSON.parse(a).bomFormat).toBe("CycloneDX");
    expect(a).toBe(b);
  });

  test("lock export leaves harness dirs untouched", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p6c-export-harness");
    writeSampleLock(project.cwd);
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeText(join(project.cwd, ".cursor", "keep.txt"), "sentinel\n");
    const before = listFilesRecursive(join(project.cwd, ".cursor"));
    const beforeLock = readLockBytes(project.cwd);

    const { result, stdout } = await runInProject(project.cwd, [
      "lock",
      "export",
      "--timestamp",
      "2020-01-01T00:00:00Z",
    ]);
    expect(result).toBe(0);
    expect(JSON.parse(stdoutText(stdout).trim()).bomFormat).toBe("CycloneDX");
    expect(listFilesRecursive(join(project.cwd, ".cursor"))).toEqual(before);
    expect(Buffer.compare(readLockBytes(project.cwd), beforeLock)).toBe(0);
  });

  test("lock help mentions export and parallel-downloads 0 = serial", async () => {
    project = createTempProject();
    const viaFlag = await runInProject(project.cwd, ["lock", "--help"]);
    const viaHelp = await runInProject(project.cwd, ["help", "lock"]);
    const text = `${viaFlag.combined}\n${viaHelp.combined}`;
    expect(text).toMatch(/\bexport\b/i);
    expect(text).toMatch(/parallel-downloads/i);
    expect(text).toMatch(/0.*serial|serial.*0/i);
  });
});
