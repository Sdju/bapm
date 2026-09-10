/**
 * producer-pack-check-versions — CLI gate: plugin.json source, strategies, skip, dry path.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectCheckVersionsKnown,
  expectKnownCommand,
  findZipUnder,
  runInProject,
  writeConformingManifest,
  writeMarketplaceProject,
  writePluginPackage,
  writeText,
  writeYamlPackage,
  type TempProject,
} from "./check-versions-helpers.ts";

describe("CLI pack --check-versions gate", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("gate-only --check-versions succeeds without --archive and leaves no zip", async () => {
    project = createTempProject();
    writeMarketplaceProject(project.cwd, {
      projectVersion: "1.2.3",
      marketVersion: "1.2.3",
      packages: [{ name: "demo", source: "./plugins/demo" }],
    });
    writePluginPackage(project.cwd, "plugins/demo", "1.2.3");

    const { result, combined } = await runInProject(project.cwd, ["pack", "--check-versions"]);
    expectKnownCommand(combined, "pack");
    expectCheckVersionsKnown(combined);
    expect(result).toBe(0);
    expect(findZipUnder(project.cwd)).toBeUndefined();
  });

  test("no marketplace block skips informatively with exit 0", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd, { name: "no-mp", version: "0.1.0" });

    const { result, combined } = await runInProject(project.cwd, ["pack", "--check-versions"]);
    expectKnownCommand(combined, "pack");
    expectCheckVersionsKnown(combined);
    expect(result).toBe(0);
    expect(combined).toMatch(/no marketplace|nothing to check|skip/i);
  });

  test("plugin-only local package uses plugin.json version (lockstep aligned)", async () => {
    project = createTempProject();
    writeMarketplaceProject(project.cwd, {
      projectVersion: "1.2.3",
      marketVersion: "1.2.3",
      packages: [{ name: "my-plugin", source: "./plugins/my-plugin" }],
    });
    writePluginPackage(project.cwd, "plugins/my-plugin", "1.2.3");

    const { result, combined } = await runInProject(project.cwd, ["pack", "--check-versions"]);
    expectKnownCommand(combined, "pack");
    expectCheckVersionsKnown(combined);
    expect(result).toBe(0);
  });

  test("OpenAPM manifest wins over plugin.json for alignment", async () => {
    project = createTempProject();
    writeMarketplaceProject(project.cwd, {
      projectVersion: "1.2.3",
      marketVersion: "1.2.3",
      packages: [{ name: "my-plugin", source: "./plugins/my-plugin" }],
    });
    writeYamlPackage(project.cwd, "plugins/my-plugin", "1.2.3", "apm.yml");
    writePluginPackage(project.cwd, "plugins/my-plugin", "9.9.9");

    const { result, combined } = await runInProject(project.cwd, ["pack", "--check-versions"]);
    expectKnownCommand(combined, "pack");
    expectCheckVersionsKnown(combined);
    expect(result).toBe(0);
  });

  test("invalid preferred manifest does not fall back to plugin.json", async () => {
    project = createTempProject();
    writeMarketplaceProject(project.cwd, {
      packages: [{ name: "my-plugin", source: "./plugins/my-plugin" }],
    });
    writeText(project.cwd, "plugins/my-plugin/apm.yml", "version: [1.2.3\n");
    writePluginPackage(project.cwd, "plugins/my-plugin", "1.0.0");

    const { result, combined } = await runInProject(project.cwd, ["pack", "--check-versions"]);
    expectKnownCommand(combined, "pack");
    expectCheckVersionsKnown(combined);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/malformed|invalid|yaml|apm\.yml|bapm\.yml/i);
  });

  test("missing plugin.json version fails with diagnostic", async () => {
    project = createTempProject();
    writeMarketplaceProject(project.cwd, {
      packages: [{ name: "my-plugin", source: "./plugins/my-plugin" }],
    });
    writePluginPackage(project.cwd, "plugins/my-plugin", null);

    const { result, combined } = await runInProject(project.cwd, ["pack", "--check-versions"]);
    expectKnownCommand(combined, "pack");
    expectCheckVersionsKnown(combined);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/missing.*version.*plugin\.json|plugin\.json.*version/i);
  });

  test("malformed plugin.json fails closed", async () => {
    project = createTempProject();
    writeMarketplaceProject(project.cwd, {
      packages: [{ name: "my-plugin", source: "./plugins/my-plugin" }],
    });
    writeText(project.cwd, "plugins/my-plugin/plugin.json", "{not-json\n");

    const { result, combined } = await runInProject(project.cwd, ["pack", "--check-versions"]);
    expectKnownCommand(combined, "pack");
    expectCheckVersionsKnown(combined);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/malformed|invalid|plugin\.json|json/i);
  });

  test("lockstep drift fails with expected marketplace version diagnostic", async () => {
    project = createTempProject();
    writeMarketplaceProject(project.cwd, {
      projectVersion: "1.0.0",
      marketVersion: "1.0.0",
      strategy: "lockstep",
      packages: [{ name: "demo", source: "./plugins/demo" }],
    });
    writePluginPackage(project.cwd, "plugins/demo", "2.0.0");

    const { result, combined } = await runInProject(project.cwd, ["pack", "--check-versions"]);
    expectKnownCommand(combined, "pack");
    expectCheckVersionsKnown(combined);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/1\.0\.0|expected|mismatch|drift|does not match/i);
  });

  test("per_package accepts divergent local versions", async () => {
    project = createTempProject();
    writeMarketplaceProject(project.cwd, {
      projectVersion: "1.0.0",
      marketVersion: "1.0.0",
      strategy: "per_package",
      packages: [
        { name: "a", source: "./plugins/a" },
        { name: "b", source: "./plugins/b" },
      ],
    });
    writePluginPackage(project.cwd, "plugins/a", "1.0.0");
    writePluginPackage(project.cwd, "plugins/b", "9.9.9");

    const { result, combined } = await runInProject(project.cwd, ["pack", "--check-versions"]);
    expectKnownCommand(combined, "pack");
    expectCheckVersionsKnown(combined);
    expect(result).toBe(0);
  });
});
