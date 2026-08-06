/**
 * marketplace-cli-authoring — package add|set|remove.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownMarketplaceSub,
  readText,
  runInProject,
  type TempProject,
  validAuthoringStub,
  writeText,
} from "./authoring-helpers.ts";

describe("mp-authoring-yml CLI marketplace package CRUD", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("package add writes entry with --no-verify", async () => {
    project = createTempProject();
    writeText(project.cwd, "bapm.yml", validAuthoringStub());

    const { result, combined } = await runInProject(project.cwd, [
      "marketplace",
      "package",
      "add",
      "acme/tools",
      "--name",
      "tools",
      "--ref",
      "main",
      "--no-verify",
    ]);
    expectKnownMarketplaceSub(combined, "package");
    expect(result).toBe(0);
    const yml = readText(project.cwd, "bapm.yml");
    expect(yml).toMatch(/name:\s*tools/);
    expect(yml).toMatch(/acme\/tools/);
  });

  test("package add rejects both --version and --ref", async () => {
    project = createTempProject();
    writeText(project.cwd, "bapm.yml", validAuthoringStub());
    const before = readText(project.cwd, "bapm.yml");

    const { result, combined } = await runInProject(project.cwd, [
      "marketplace",
      "package",
      "add",
      "acme/tools",
      "--name",
      "tools",
      "--version",
      "^1.0.0",
      "--ref",
      "main",
      "--no-verify",
    ]);
    expectKnownMarketplaceSub(combined, "package");
    expect(result).not.toBe(0);
    expect(readText(project.cwd, "bapm.yml")).toBe(before);
    expect(before).not.toMatch(/name:\s*tools/);
  });

  test("package remove without -y fails non-interactive", async () => {
    project = createTempProject();
    writeText(project.cwd, "bapm.yml", validAuthoringStub());
    const before = readText(project.cwd, "bapm.yml");

    const { result, combined } = await runInProject(project.cwd, [
      "marketplace",
      "package",
      "remove",
      "demo",
    ]);
    expectKnownMarketplaceSub(combined, "package");
    expect(result).not.toBe(0);
    expect(readText(project.cwd, "bapm.yml")).toBe(before);
    expect(before).toMatch(/name:\s*demo/);
  });

  test("package remove -y removes entry", async () => {
    project = createTempProject();
    writeText(project.cwd, "bapm.yml", validAuthoringStub());

    const { result, combined } = await runInProject(project.cwd, [
      "marketplace",
      "package",
      "remove",
      "demo",
      "-y",
    ]);
    expectKnownMarketplaceSub(combined, "package");
    expect(result).toBe(0);
    const yml = readText(project.cwd, "bapm.yml");
    expect(yml).not.toMatch(/name:\s*demo/);
  });
});
