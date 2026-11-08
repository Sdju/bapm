/**
 * Marketplace Copilot output profile — default path, shape, override, path jail.
 */
import { existsSync } from "node:fs";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  assertTrailingNewlineIndent2,
  copilotMarketplacePath,
  createTempProject,
  expectKnownCommand,
  hasCopilotMarketplaceJson,
  parseJsonFile,
  readText,
  runInProject,
  type TempProject,
  writeCopilotLocalAuthoring,
  writeText,
} from "./pack-outputs-helpers.ts";

describe("mp-pack-outputs CLI Copilot emit", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("Copilot output writes .github/plugin/marketplace.json with Copilot shape", async () => {
    project = createTempProject();
    writeCopilotLocalAuthoring(project.cwd);

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--marketplace",
      "copilot",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(0);
    expect(hasCopilotMarketplaceJson(project.cwd)).toBe(true);

    const raw = readText(project.cwd, ".github/plugin/marketplace.json");
    assertTrailingNewlineIndent2(raw);
    const doc = parseJsonFile(copilotMarketplacePath(project.cwd)) as Record<string, unknown>;
    expect(doc).toMatchObject({
      name: "copilot-marketplace",
      owner: { name: "acme-org", email: "dev@example.com" },
      metadata: {
        description: "Copilot marketplace pack fixture",
        version: "0.3.0",
      },
      plugins: [
        {
          name: "demo",
          description: "Demo plugin",
          version: "1.0.0",
          source: "./plugins/demo",
        },
      ],
    });
  });

  test("Copilot path override honors --marketplace-path and outputs.copilot.path", async () => {
    project = createTempProject();
    writeCopilotLocalAuthoring(project.cwd);

    const cli = await runInProject(project.cwd, [
      "pack",
      "--marketplace",
      "copilot",
      "--marketplace-path",
      "copilot=dist/copilot/marketplace.json",
    ]);
    expectKnownCommand(cli.combined, "pack");
    expect(cli.result).toBe(0);
    expect(existsSync(`${project.cwd}/dist/copilot/marketplace.json`)).toBe(true);
    expect(hasCopilotMarketplaceJson(project.cwd)).toBe(false);

    project.cleanup();
    project = createTempProject();
    writeCopilotLocalAuthoring(project.cwd);
    const configuredManifest = readText(project.cwd, "bapm.yml").replace(
      "    copilot: true",
      "    copilot:\n      path: configured/copilot.json",
    );
    writeText(project.cwd, "bapm.yml", configuredManifest);

    const configured = await runInProject(project.cwd, ["pack", "--marketplace", "copilot"]);
    expectKnownCommand(configured.combined, "pack");
    expect(configured.result).toBe(0);
    expect(existsSync(`${project.cwd}/configured/copilot.json`)).toBe(true);
    expect(hasCopilotMarketplaceJson(project.cwd)).toBe(false);
  });

  test("Copilot path jail rejects escapes and writes nothing outside root", async () => {
    project = createTempProject();
    writeCopilotLocalAuthoring(project.cwd);

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--marketplace",
      "copilot",
      "--marketplace-path",
      "copilot=../outside-copilot.json",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).not.toBe(0);
    expect(combined).toMatch(/path jail|outside|escape/i);
    expect(existsSync(`${project.root}/outside-copilot.json`)).toBe(false);
    expect(hasCopilotMarketplaceJson(project.cwd)).toBe(false);
  });
});
