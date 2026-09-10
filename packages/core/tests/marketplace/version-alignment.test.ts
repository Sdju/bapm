/**
 * producer-pack-check-versions — local version source + strategy unit tests.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkReleaseTag, checkVersionAlignment, loadMarketplaceFromBapmYml } from "@b-apm/core";

function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

function marketplaceYaml(opts: {
  marketVersion?: string;
  strategy?: string;
  packages?: Array<{ name: string; source: string }>;
}): string {
  const marketVersion = opts.marketVersion ?? "1.0.0";
  const packages = opts.packages ?? [{ name: "demo", source: "./plugins/demo" }];
  const lines = [
    `name: mono`,
    `version: "${marketVersion}"`,
    `marketplace:`,
    `  version: "${marketVersion}"`,
    `  owner: acme`,
  ];
  if (opts.strategy) {
    lines.push(`  versioning:`, `    strategy: ${opts.strategy}`);
  }
  lines.push(`  packages:`);
  for (const p of packages) {
    lines.push(`    - name: ${p.name}`, `      source: ${p.source}`);
  }
  lines.push(``);
  return lines.join("\n");
}

describe("checkVersionAlignment local version source", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("plugin-only OK", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-va-plugin-"));
    writeText(join(cwd, "bapm.yml"), marketplaceYaml({ marketVersion: "1.2.3" }));
    writeText(
      join(cwd, "plugins/demo/plugin.json"),
      JSON.stringify({ name: "demo", version: "1.2.3" }),
    );
    const { config } = loadMarketplaceFromBapmYml({ cwd });
    const report = checkVersionAlignment({ config, cwd });
    expect(report.ok).toBe(true);
    expect(report.packages[0]!.version).toBe("1.2.3");
  });

  test("manifest wins over plugin.json", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-va-manifest-"));
    writeText(join(cwd, "bapm.yml"), marketplaceYaml({ marketVersion: "1.2.3" }));
    writeText(join(cwd, "plugins/demo/apm.yml"), `name: demo\nversion: "1.2.3"\n`);
    writeText(
      join(cwd, "plugins/demo/plugin.json"),
      JSON.stringify({ name: "demo", version: "9.9.9" }),
    );
    const { config } = loadMarketplaceFromBapmYml({ cwd });
    const report = checkVersionAlignment({ config, cwd });
    expect(report.ok).toBe(true);
    expect(report.packages[0]!.version).toBe("1.2.3");
  });

  test("invalid YAML no fallback", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-va-badyml-"));
    writeText(join(cwd, "bapm.yml"), marketplaceYaml({}));
    writeText(join(cwd, "plugins/demo/apm.yml"), "version: [1.2.3\n");
    writeText(
      join(cwd, "plugins/demo/plugin.json"),
      JSON.stringify({ name: "demo", version: "1.2.3" }),
    );
    const { config } = loadMarketplaceFromBapmYml({ cwd });
    const report = checkVersionAlignment({ config, cwd });
    expect(report.ok).toBe(false);
    expect(report.packages[0]!.reason).toMatch(/invalid_yaml/);
  });

  test("missing plugin version fails", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-va-miss-"));
    writeText(join(cwd, "bapm.yml"), marketplaceYaml({}));
    writeText(join(cwd, "plugins/demo/plugin.json"), JSON.stringify({ name: "demo" }));
    const { config } = loadMarketplaceFromBapmYml({ cwd });
    const report = checkVersionAlignment({ config, cwd });
    expect(report.ok).toBe(false);
    expect(report.packages[0]!.reason).toBe("missing_plugin_version");
  });

  test("malformed plugin.json fails", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-va-badjson-"));
    writeText(join(cwd, "bapm.yml"), marketplaceYaml({}));
    writeText(join(cwd, "plugins/demo/plugin.json"), "{not-json\n");
    const { config } = loadMarketplaceFromBapmYml({ cwd });
    const report = checkVersionAlignment({ config, cwd });
    expect(report.ok).toBe(false);
    expect(report.packages[0]!.reason).toBe("invalid_plugin_json");
  });

  test("oversized plugin.json fails", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-va-huge-"));
    writeText(join(cwd, "bapm.yml"), marketplaceYaml({}));
    const huge = `{"name":"demo","version":"1.0.0","pad":"${"x".repeat(1024 * 1024)}"}`;
    writeText(join(cwd, "plugins/demo/plugin.json"), huge);
    const { config } = loadMarketplaceFromBapmYml({ cwd });
    const report = checkVersionAlignment({ config, cwd });
    expect(report.ok).toBe(false);
    expect(report.packages[0]!.reason).toBe("invalid_plugin_json");
  });

  test("lockstep drift fails", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-va-drift-"));
    writeText(
      join(cwd, "bapm.yml"),
      marketplaceYaml({ marketVersion: "1.0.0", strategy: "lockstep" }),
    );
    writeText(
      join(cwd, "plugins/demo/plugin.json"),
      JSON.stringify({ name: "demo", version: "2.0.0" }),
    );
    const { config } = loadMarketplaceFromBapmYml({ cwd });
    const report = checkVersionAlignment({ config, cwd });
    expect(report.ok).toBe(false);
    expect(report.packages[0]!.reason).toMatch(/drift:expected=1\.0\.0/);
  });

  test("per_package divergent OK", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-va-per-"));
    writeText(
      join(cwd, "bapm.yml"),
      marketplaceYaml({
        strategy: "per_package",
        packages: [
          { name: "a", source: "./plugins/a" },
          { name: "b", source: "./plugins/b" },
        ],
      }),
    );
    writeText(join(cwd, "plugins/a/plugin.json"), JSON.stringify({ name: "a", version: "1.0.0" }));
    writeText(join(cwd, "plugins/b/plugin.json"), JSON.stringify({ name: "b", version: "9.9.9" }));
    const { config } = loadMarketplaceFromBapmYml({ cwd });
    const report = checkVersionAlignment({ config, cwd });
    expect(report.ok).toBe(true);
  });

  test("checkVersionAlignment exported distinct from checkReleaseTag", () => {
    expect(typeof checkVersionAlignment).toBe("function");
    expect(typeof checkReleaseTag).toBe("function");
    expect(checkVersionAlignment).not.toBe(checkReleaseTag);
  });
});
