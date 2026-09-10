/**
 * producer-pack-check-versions — strategy evaluation over local packages.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  buildMarketplaceBapmYml,
  createTempProject,
  getCheckVersionAlignment,
  pickExport,
  reportOk,
  reportPackages,
  reportStrategy,
  runAlignment,
  writeBapmYml,
  writePluginPackage,
  writeYamlPackage,
  type TempProject,
} from "./version-alignment-helpers.ts";

describe("checkVersionAlignment — strategy evaluation", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("lockstep: aligned local packages pass", async () => {
    project = createTempProject();
    writeBapmYml(
      project.cwd,
      buildMarketplaceBapmYml({
        projectVersion: "1.0.0",
        marketVersion: "1.0.0",
        strategy: "lockstep",
        packages: [
          { name: "a", source: "./plugins/a" },
          { name: "b", source: "./plugins/b" },
        ],
      }),
    );
    writeYamlPackage(project.cwd, "plugins/a", "1.0.0");
    writeYamlPackage(project.cwd, "plugins/b", "1.0.0");

    const report = await runAlignment(project.cwd);
    expect(reportOk(report)).toBe(true);
    expect(reportStrategy(report)).toBe("lockstep");
    expect(reportPackages(report).every((p) => p.ok === true)).toBe(true);
  });

  test("lockstep: drift fails", async () => {
    project = createTempProject();
    writeBapmYml(
      project.cwd,
      buildMarketplaceBapmYml({
        projectVersion: "1.0.0",
        marketVersion: "1.0.0",
        strategy: "lockstep",
        packages: [
          { name: "a", source: "./plugins/a" },
          { name: "b", source: "./plugins/b" },
        ],
      }),
    );
    writeYamlPackage(project.cwd, "plugins/a", "1.0.0");
    writeYamlPackage(project.cwd, "plugins/b", "0.9.0");

    const report = await runAlignment(project.cwd);
    expect(reportOk(report)).toBe(false);
    const bad = reportPackages(report).filter((p) => p.ok === false);
    expect(bad.length).toBeGreaterThanOrEqual(1);
    expect(String((bad[0]!.path as string | undefined | null) ?? "")).toMatch(/plugins\/b|b$/);
    expect(
      String(
        (bad[0]!.reason as string | undefined | null) ??
          (bad[0]!.error as string | undefined | null) ??
          "",
      ),
    ).toMatch(/drift|expected|1\.0\.0/i);
  });

  test("per_package accepts divergent versions", async () => {
    project = createTempProject();
    writeBapmYml(
      project.cwd,
      buildMarketplaceBapmYml({
        projectVersion: "1.0.0",
        marketVersion: "1.0.0",
        strategy: "per_package",
        packages: [
          { name: "a", source: "./plugins/a" },
          { name: "b", source: "./plugins/b" },
        ],
      }),
    );
    writePluginPackage(project.cwd, "plugins/a", "1.0.0");
    writePluginPackage(project.cwd, "plugins/b", "9.9.9");

    const report = await runAlignment(project.cwd);
    expect(reportOk(report)).toBe(true);
    expect(reportStrategy(report)).toBe("per_package");
  });

  test("remote packages are ignored by the gate", async () => {
    project = createTempProject();
    writeBapmYml(
      project.cwd,
      [
        `name: monorepo`,
        `version: "1.0.0"`,
        `marketplace:`,
        `  version: "1.0.0"`,
        `  owner: acme-org`,
        `  versioning:`,
        `    strategy: lockstep`,
        `  packages:`,
        `    - name: local`,
        `      source: ./plugins/local`,
        `    - name: remote`,
        `      source: github.com/some-org/some-repo`,
        `      version: ">=1.0.0"`,
        ``,
      ].join("\n"),
    );
    writeYamlPackage(project.cwd, "plugins/local", "1.0.0");

    const report = await runAlignment(project.cwd);
    expect(reportOk(report)).toBe(true);
    const paths = reportPackages(report).map((p) =>
      String((p.path as string | undefined | null) ?? ""),
    );
    expect(paths.some((p) => /local/.test(p))).toBe(true);
    expect(paths.some((p) => /remote|some-repo/.test(p))).toBe(false);
  });

  test("checkVersionAlignment is distinct from checkReleaseTag export", () => {
    const checkVersions = getCheckVersionAlignment();
    const checkRelease = pickExport(
      ["checkReleaseTag", "checkRelease", "runCheckRelease"],
      "pr-004 release gate",
    );
    expect(checkVersions).not.toBe(checkRelease);
  });
});
