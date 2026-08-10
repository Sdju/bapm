/**
 * CLI init — fresh scaffold, refuse overwrite, unknown flags.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadManifest } from "@b-apm/core";
import {
  createTempProject,
  expectKnownCommand,
  runInProject,
  type TempProject,
} from "./helpers.ts";

const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

describe("CLI init", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("§14 fresh init -y writes bapm.yml with name+version; exit 0", async () => {
    project = createTempProject();
    const { result, combined } = await runInProject(project.cwd, ["init", "-y", "my-pkg"]);
    expectKnownCommand(combined, "init");
    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, "bapm.yml"))).toBe(true);
    expect(existsSync(join(project.cwd, "apm.yml"))).toBe(false);

    const { document: doc, sourceFilename } = loadManifest({ cwd: project.cwd });
    expect(sourceFilename).toBe("bapm.yml");
    expect(typeof doc.name).toBe("string");
    expect(String(doc.name).length).toBeGreaterThan(0);
    expect(typeof doc.version).toBe("string");
    expect(String(doc.version)).toMatch(SEMVER_RE);
    expect(doc).not.toHaveProperty("workspaces");
  });

  test("init -y --target cursor writes object-map targets + active", async () => {
    project = createTempProject();
    const { result, combined } = await runInProject(project.cwd, [
      "init",
      "-y",
      "cursor-pkg",
      "--target",
      "cursor",
    ]);
    expectKnownCommand(combined, "init");
    expect(result).toBe(0);

    const raw = readFileSync(join(project.cwd, "bapm.yml"), "utf8");
    expect(raw).toMatch(/targets:/);
    expect(raw).toMatch(/cursor:\s*["']?@bapm\/integration-cursor["']?/);
    expect(raw).toMatch(/active:/);
    expect(raw).toMatch(/-\s*cursor/);

    const { document: doc } = loadManifest({ cwd: project.cwd });
    const targets = doc.targets ?? doc.target;
    expect(targets).toBeTruthy();
    expect(typeof targets).toBe("object");
    expect(Array.isArray(targets)).toBe(false);
    expect((targets as Record<string, string>).cursor).toBe("@b-apm/integration-cursor");
    expect(doc.active).toEqual(["cursor"]);
  });

  test("§15 existing bapm.yml blocks init — non-zero, no overwrite", async () => {
    project = createTempProject();
    const path = join(project.cwd, "bapm.yml");
    const original = 'name: keep-me\nversion: "9.9.9"\n';
    writeFileSync(path, original, "utf8");

    const { result, combined } = await runInProject(project.cwd, ["init", "-y", "other"]);
    expectKnownCommand(combined, "init");
    expect(result).not.toBe(0);
    expect(readFileSync(path, "utf8")).toBe(original);
  });

  test("existing apm.yml blocks init — non-zero, no overwrite", async () => {
    project = createTempProject();
    const path = join(project.cwd, "apm.yml");
    const original = 'name: keep-apm\nversion: "8.8.8"\n';
    writeFileSync(path, original, "utf8");

    const { result, combined } = await runInProject(project.cwd, ["init", "-y", "other"]);
    expectKnownCommand(combined, "init");
    expect(result).not.toBe(0);
    expect(readFileSync(path, "utf8")).toBe(original);
    expect(existsSync(join(project.cwd, "bapm.yml"))).toBe(false);
  });

  test("unknown init flag hard-errors", async () => {
    project = createTempProject();
    const { result, stderr, combined } = await runInProject(project.cwd, [
      "init",
      "--not-a-real-flag",
    ]);
    expectKnownCommand(combined, "init");
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/not-a-real-flag|unknown.*flag/i);
  });
});
