/**
 * CLI init — fresh scaffold, refuse overwrite, unknown flags.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadManifest } from "@b-apm/core";
import { linkPackageDir } from "../install/helpers.ts";
import {
  createTempProject,
  expectKnownCommand,
  runInProject,
  type TempProject,
} from "./helpers.ts";

const PACKAGES_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

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

  test("init -y --target cursor writes active only (no narrowing targets)", async () => {
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
    expect(raw).toMatch(/active:/);
    expect(raw).toMatch(/-\s*target:\s*cursor/);
    expect(raw).not.toMatch(/^targets:/m);
    expect(raw).not.toMatch(/^target:/m);
    expect(raw).not.toMatch(/@b-apm\/integration-cursor/);

    const { document: doc } = loadManifest({ cwd: project.cwd });
    expect(doc).not.toHaveProperty("targets");
    expect(doc).not.toHaveProperty("target");
    expect(doc.active).toEqual([{ kind: "target", id: "cursor", negate: false }]);
  });

  test("init -y auto-detects .cursor/ as active only (no targets)", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });

    const { result, combined } = await runInProject(project.cwd, ["init", "-y", "detect-pkg"]);
    expectKnownCommand(combined, "init");
    expect(result).toBe(0);

    const raw = readFileSync(join(project.cwd, "bapm.yml"), "utf8");
    expect(raw).not.toMatch(/^targets:/m);
    expect(raw).not.toMatch(/^target:/m);
    expect(raw).toMatch(/-\s*target:\s*cursor/);

    const { document: doc } = loadManifest({ cwd: project.cwd });
    expect(doc).not.toHaveProperty("targets");
    expect(doc.active).toEqual([{ kind: "target", id: "cursor", negate: false }]);
  });

  test("install --target claude still deploys after init --target cursor", async () => {
    project = createTempProject();
    const { result: initResult } = await runInProject(project.cwd, [
      "init",
      "-y",
      "multi-agent",
      "--target",
      "cursor",
    ]);
    expect(initResult).toBe(0);

    linkPackageDir(project.cwd, join(PACKAGES_ROOT, "integration-claude"));
    linkPackageDir(project.cwd, join(PACKAGES_ROOT, "integration-cursor"));

    const manifestPath = join(project.cwd, "bapm.yml");
    const manifest = readFileSync(manifestPath, "utf8").replace(
      "  apm: []",
      "  apm:\n    - path: ./leaf",
    );
    writeFileSync(manifestPath, manifest, "utf8");

    mkdirSync(join(project.cwd, "leaf", ".apm", "skills", "hello"), { recursive: true });
    writeFileSync(
      join(project.cwd, "leaf", "apm.yml"),
      "name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n",
      "utf8",
    );
    writeFileSync(
      join(project.cwd, "leaf", ".apm", "skills", "hello", "SKILL.md"),
      "---\nname: hello\n---\n# Hello\n",
      "utf8",
    );

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "claude"]);
    expect(combined).not.toMatch(/empty intersection|not installed or resolvable/i);
    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, ".claude", "skills", "hello", "SKILL.md"))).toBe(true);
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
