/**
 * CLI M7 — pack, --check-release, secrets, dry-run (C §7–12, 18–20).
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectKnownCommand,
  findZipUnder,
  runInProject,
  writeConformingManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("CLI pack", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("pack --archive produces plain zip with manifest; known command", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd, { name: "cli-pack", version: "1.2.3" });

    const { result, combined } = await runInProject(project.cwd, ["pack", "--archive"]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(0);

    const zip = findZipUnder(project.cwd);
    expect(zip, "expected zip under project cwd").toBeTruthy();
    const magic = readFileSync(zip!).subarray(0, 2).toString("utf8");
    expect(magic).toBe("PK");
    const bytes = readFileSync(zip!).toString("binary");
    expect(bytes.includes("bapm.yml") || bytes.includes("apm.yml")).toBe(true);
  });

  test("pack refuses .env (sc-007) — non-zero, no successful zip", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd, { name: "cli-secret", version: "1.0.0" });
    writeText(project.cwd, ".env", "TOKEN=secret\n");

    const { result, combined } = await runInProject(project.cwd, ["pack", "--archive"]);
    expectKnownCommand(combined, "pack");
    expect(result).not.toBe(0);
    expect(findZipUnder(project.cwd)).toBeUndefined();
  });

  test("pack --archive --dry-run leaves no durable zip", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd, { name: "cli-dry", version: "0.1.0" });

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--archive",
      "--dry-run",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(0);
    expect(findZipUnder(project.cwd)).toBeUndefined();
  });

  test("pack fails on invalid manifest", async () => {
    project = createTempProject();
    writeText(project.cwd, "bapm.yml", 'version: "1.0.0"\n');

    const { result, combined } = await runInProject(project.cwd, ["pack", "--archive"]);
    expectKnownCommand(combined, "pack");
    expect(result).not.toBe(0);
    expect(findZipUnder(project.cwd)).toBeUndefined();
  });

  test("unknown pack flag hard-errors", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd);
    const { result, stderr, combined } = await runInProject(project.cwd, [
      "pack",
      "--not-a-real-flag",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/not-a-real-flag|unknown.*flag/i);
  });
});

describe("CLI pack --check-release (pr-004)", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("§10 aligned --tag v1.2.3 passes", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd, { name: "rel", version: "1.2.3" });

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--check-release",
      "--tag",
      "v1.2.3",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(0);
  });

  test("§11 mismatched --tag fails", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd, { name: "rel-bad", version: "1.2.3" });

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--check-release",
      "--tag",
      "v9.9.9",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).not.toBe(0);
  });

  test("§12 non-semver --tag fails", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd, { name: "rel-shape", version: "1.2.3" });

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--check-release",
      "--tag",
      "release-foo",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).not.toBe(0);
  });
});
