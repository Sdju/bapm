/**
 * `bapm pack --strict-metadata` — conservative producer metadata preflight (APM exit 5).
 *
 * Specs: producer-pack-archive, marketplace-authoring-schema.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  findZipUnder,
  hasClaudeMarketplaceJson,
  linkClaudeIntegration,
  runInProject,
  type TempProject,
  writeText,
} from "./pack-outputs-helpers.ts";

const VALID_METADATA = [
  `name: strict-ok`,
  `version: "1.2.3"`,
  `description: A conforming strict metadata package`,
  `author: Acme`,
  `license: MIT`,
  `homepage: https://example.com/strict-ok`,
  `repository: https://github.com/acme/strict-ok`,
  `keywords:`,
  `  - strict`,
  `  - metadata`,
].join("\n");

function writeManifest(cwd: string, lines: string[]): void {
  writeText(cwd, "bapm.yml", `${lines.join("\n")}\ndependencies:\n  apm: []\n  mcp: []\n`);
}

describe("CLI pack --strict-metadata", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("valid metadata passes and still writes the archive", async () => {
    project = createTempProject();
    writeManifest(project.cwd, VALID_METADATA.split("\n"));

    const { result, combined } = await runInProject(project.cwd, ["pack", "--strict-metadata"]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(0);
    expect(findZipUnder(project.cwd)).toBeTruthy();
  });

  test("invalid field exits 5, names the field path, and leaves no zip", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      VALID_METADATA.replace('version: "1.2.3"', 'version: "not-semver"').split("\n"),
    );

    const { result, combined } = await runInProject(project.cwd, ["pack", "--strict-metadata"]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(5);
    expect(combined).toMatch(/strict metadata validation failed/i);
    expect(combined).toMatch(/bapm\.yml#\/version/);
    expect(findZipUnder(project.cwd)).toBeUndefined();
  });

  test("missing plugin.json metadata field exits 5 without a zip", async () => {
    project = createTempProject();
    writeManifest(project.cwd, [`name: strict-plugin`, `version: "1.0.0"`, `description: plugin`]);
    writeText(
      project.cwd,
      "plugin.json",
      JSON.stringify({ version: "1.0.0", description: "missing name" }, null, 2) + "\n",
    );

    const { result, combined } = await runInProject(project.cwd, ["pack", "--strict-metadata"]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(5);
    expect(combined).toMatch(/plugin\.json#\/name/);
    expect(findZipUnder(project.cwd)).toBeUndefined();
  });

  test("normal pack is unchanged and accepts the same invalid metadata", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      VALID_METADATA.replace('version: "1.2.3"', 'version: "not-semver"').split("\n"),
    );

    const { result, combined } = await runInProject(project.cwd, ["pack", "--archive"]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(0);
    expect(findZipUnder(project.cwd)).toBeTruthy();
  });

  test("--check-versions exit 3 wins over --strict-metadata exit 5", async () => {
    project = createTempProject();
    writeManifest(project.cwd, [
      `name: strict-precedence`,
      `version: "1.0.0"`,
      `description: precedence fixture`,
      `homepage: not-a-url`,
      `marketplace:`,
      `  owner: acme-org`,
      `  packages:`,
      `    - name: demo`,
      `      source: ./plugins/demo`,
    ]);
    writeText(
      project.cwd,
      "plugins/demo/plugin.json",
      JSON.stringify({ name: "demo", version: "2.0.0" }, null, 2) + "\n",
    );

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--check-versions",
      "--strict-metadata",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(3);
    expect(combined).toMatch(/version alignment failed|expected 1\.0\.0.*found 2\.0\.0/i);
    expect(findZipUnder(project.cwd)).toBeUndefined();
  });

  test("remote marketplace package without explicit metadata exits 5 before emit", async () => {
    project = createTempProject();
    linkClaudeIntegration(project.cwd);
    writeManifest(project.cwd, [
      `name: strict-remote-mp`,
      `version: "1.0.0"`,
      `description: remote marketplace fixture`,
      `marketplace:`,
      `  owner: acme-org`,
      `  outputs:`,
      `    claude: true`,
      `  packages:`,
      `    - name: remote-tool`,
      `      source: acme/remote-tool`,
      `      ref: main`,
    ]);

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--strict-metadata",
      "--marketplace",
      "claude",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(5);
    expect(combined).toMatch(/marketplace\.packages\[0\]\.description/);
    expect(hasClaudeMarketplaceJson(project.cwd)).toBe(false);
    expect(findZipUnder(project.cwd)).toBeUndefined();
  });

  test("Agent Plugins portable root validates $schema/name under strict metadata", async () => {
    project = createTempProject();
    writeText(
      project.cwd,
      "plugin.json",
      JSON.stringify(
        {
          $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
          name: "strict-agent",
          version: "1.0.0",
          description: "portable plugin",
        },
        null,
        2,
      ) + "\n",
    );

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--agent-plugins",
      "--strict-metadata",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(0);
    expect(findZipUnder(project.cwd)).toBeTruthy();
  });

  test("Agent Plugins root missing $schema exits 5 without a zip", async () => {
    project = createTempProject();
    writeText(
      project.cwd,
      "plugin.json",
      JSON.stringify({ name: "strict-agent", version: "1.0.0" }, null, 2) + "\n",
    );

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--agent-plugins",
      "--strict-metadata",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(5);
    expect(combined).toMatch(/plugin\.json#\/\$schema/);
    expect(findZipUnder(project.cwd)).toBeUndefined();
  });
});
