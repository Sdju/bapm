/**
 * producer-pack-check-versions — local version source precedence (APM TestLocalVersionSource).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  buildMarketplaceBapmYml,
  createTempProject,
  reportOk,
  reportPackages,
  runAlignment,
  writeBapmYml,
  writePluginPackage,
  writeText,
  writeYamlPackage,
  join,
  type TempProject,
} from "./helpers.ts";

describe("pack-check-versions-plugin-json — local version source", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("plugin-only package uses plugin.json version", async () => {
    project = createTempProject();
    writeBapmYml(
      project.cwd,
      buildMarketplaceBapmYml({
        projectVersion: "1.2.3",
        marketVersion: "1.2.3",
        strategy: "lockstep",
        packages: [{ name: "my-plugin", source: "./plugins/my-plugin" }],
      }),
    );
    writePluginPackage(project.cwd, "plugins/my-plugin", "1.2.3");

    const report = await runAlignment(project.cwd);
    expect(reportOk(report)).toBe(true);
    const pkgs = reportPackages(report);
    expect(pkgs).toHaveLength(1);
    expect(pkgs[0]!.version).toBe("1.2.3");
  });

  test("OpenAPM manifest wins over plugin.json", async () => {
    project = createTempProject();
    writeBapmYml(
      project.cwd,
      buildMarketplaceBapmYml({
        projectVersion: "1.2.3",
        marketVersion: "1.2.3",
        packages: [{ name: "my-plugin", source: "./plugins/my-plugin" }],
      }),
    );
    writeYamlPackage(project.cwd, "plugins/my-plugin", "1.2.3", "apm.yml");
    writePluginPackage(project.cwd, "plugins/my-plugin", "9.9.9");

    const report = await runAlignment(project.cwd);
    expect(reportOk(report)).toBe(true);
    expect(reportPackages(report)[0]!.version).toBe("1.2.3");
  });

  test("bapm.yml at package root is authoritative when present", async () => {
    project = createTempProject();
    writeBapmYml(
      project.cwd,
      buildMarketplaceBapmYml({
        projectVersion: "2.0.0",
        marketVersion: "2.0.0",
        packages: [{ name: "leaf", source: "./packages/leaf" }],
      }),
    );
    writeYamlPackage(project.cwd, "packages/leaf", "2.0.0", "bapm.yml");
    writePluginPackage(project.cwd, "packages/leaf", "0.0.1");

    const report = await runAlignment(project.cwd);
    expect(reportOk(report)).toBe(true);
    expect(reportPackages(report)[0]!.version).toBe("2.0.0");
  });

  test("invalid preferred manifest does not fall back to plugin.json", async () => {
    project = createTempProject();
    writeBapmYml(
      project.cwd,
      buildMarketplaceBapmYml({
        packages: [{ name: "my-plugin", source: "./plugins/my-plugin" }],
      }),
    );
    writeText(join(project.cwd, "plugins/my-plugin/apm.yml"), "version: [1.2.3\n");
    writePluginPackage(project.cwd, "plugins/my-plugin", "1.2.3");

    const report = await runAlignment(project.cwd);
    expect(reportOk(report)).toBe(false);
    const row = reportPackages(report)[0]!;
    expect(String(row.reason ?? row.error ?? "")).toMatch(/invalid_yaml|malformed|yaml/i);
  });

  test("missing plugin.json version fails closed", async () => {
    project = createTempProject();
    writeBapmYml(
      project.cwd,
      buildMarketplaceBapmYml({
        packages: [{ name: "my-plugin", source: "./plugins/my-plugin" }],
      }),
    );
    writePluginPackage(project.cwd, "plugins/my-plugin", null);

    const report = await runAlignment(project.cwd);
    expect(reportOk(report)).toBe(false);
    const row = reportPackages(report)[0]!;
    expect(String(row.reason ?? row.error ?? "")).toMatch(
      /missing_plugin_version|missing.*version/i,
    );
  });

  test("malformed plugin.json fails closed", async () => {
    project = createTempProject();
    writeBapmYml(
      project.cwd,
      buildMarketplaceBapmYml({
        packages: [{ name: "my-plugin", source: "./plugins/my-plugin" }],
      }),
    );
    writeText(join(project.cwd, "plugins/my-plugin/plugin.json"), "{not-json\n");

    const report = await runAlignment(project.cwd);
    expect(reportOk(report)).toBe(false);
    const row = reportPackages(report)[0]!;
    expect(String(row.reason ?? row.error ?? "")).toMatch(/invalid_plugin_json|malformed|json/i);
  });

  test("plugin.json under .claude-plugin/ is discovered (APM location order)", async () => {
    project = createTempProject();
    writeBapmYml(
      project.cwd,
      buildMarketplaceBapmYml({
        projectVersion: "3.1.4",
        marketVersion: "3.1.4",
        packages: [{ name: "nested", source: "./plugins/nested" }],
      }),
    );
    writeText(
      join(project.cwd, "plugins/nested/.claude-plugin/plugin.json"),
      JSON.stringify({ name: "nested", version: "3.1.4" }),
    );

    const report = await runAlignment(project.cwd);
    expect(reportOk(report)).toBe(true);
    expect(reportPackages(report)[0]!.version).toBe("3.1.4");
  });
});
