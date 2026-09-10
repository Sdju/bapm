/**
 * Direct wins over transitive; dry-run skips registration writes;
 * uninstall/prune retire owned catalog/settings keys.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectCatalogListsPlugin,
  expectSettingsEnablePlugin,
  getRunPrune,
  getRunUninstall,
  installForCopilot,
  ledgerPath,
  marketplacePath,
  readJson,
  settingsPath,
  writeConsumerManifest,
  writeJson,
  writePortablePlugin,
  writeText,
  type TempProject,
} from "./copilot-native-helpers.ts";

describe("copilot native registration precedence and lifecycle", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("direct dependency wins over transitive for shared plugin name", async () => {
    project = createTempProject("bapm-cnap-direct-");
    writePortablePlugin(join(project.cwd, "direct"), {
      pluginName: "shared",
      packageName: "pkg-direct",
      skill: "s",
      withApmYml: true,
    });
    writePortablePlugin(join(project.cwd, "mid"), {
      pluginName: "mid-plugin",
      packageName: "pkg-mid",
      skill: "mid-skill",
      deps: ["../transitive"],
      withApmYml: true,
    });
    writePortablePlugin(join(project.cwd, "transitive"), {
      pluginName: "shared",
      packageName: "pkg-transitive",
      skill: "s",
      withApmYml: true,
    });
    // Mark direct skill body uniquely
    writeText(
      join(project.cwd, "direct", "skills", "s", "SKILL.md"),
      "---\nname: s\n---\n# pkg-direct-owner\n",
    );
    writeText(
      join(project.cwd, "transitive", "skills", "s", "SKILL.md"),
      "---\nname: s\n---\n# pkg-transitive-loser\n",
    );
    writeConsumerManifest(project, {
      name: "direct-wins",
      pluginRel: ["./direct", "./mid"],
    });

    await installForCopilot(project);

    expectCatalogListsPlugin(project.cwd, "shared");
    expectSettingsEnablePlugin(project.cwd, "shared");
    const catalog = readFileSync(marketplacePath(project.cwd), "utf8");
    expect(catalog).toMatch(/pkg-direct|local_direct|direct/);
    expect(catalog).not.toMatch(/pkg-transitive-loser/);
    const ledger = readFileSync(ledgerPath(project.cwd), "utf8");
    expect(ledger).toMatch(/shared/);
    expect(ledger).toMatch(/pkg-direct|local_direct|direct/);
  });

  test("dry-run install skips catalog, ledger, and settings writes", async () => {
    project = createTempProject("bapm-cnap-dry-");
    writePortablePlugin(join(project.cwd, "plugin"), { pluginName: "my-plugin" });
    writeConsumerManifest(project);
    writeJson(settingsPath(project.cwd), { preexist: true });
    const settingsBefore = readFileSync(settingsPath(project.cwd), "utf8");

    const result = await installForCopilot(project, { dryRun: true });
    expect(result).toMatchObject({ ok: true });

    expect(existsSync(marketplacePath(project.cwd))).toBe(false);
    expect(existsSync(ledgerPath(project.cwd))).toBe(false);
    expect(readFileSync(settingsPath(project.cwd), "utf8")).toBe(settingsBefore);
  });

  test("uninstall removes owned enable key and catalog row", async () => {
    project = createTempProject("bapm-cnap-un-");
    writePortablePlugin(join(project.cwd, "plugin"), {
      pluginName: "my-plugin",
      packageName: "my-plugin",
      withApmYml: true,
    });
    writePortablePlugin(join(project.cwd, "keep"), {
      pluginName: "keep-plugin",
      packageName: "keep-plugin",
      skill: "keep-skill",
      withApmYml: true,
    });
    writeConsumerManifest(project, {
      name: "uninstall-one",
      pluginRel: ["./plugin", "./keep"],
    });
    writeJson(settingsPath(project.cwd), {
      theme: "keep-me",
      enabledPlugins: { "hand@other": true },
    });

    await installForCopilot(project);
    expectSettingsEnablePlugin(project.cwd, "my-plugin");
    expectSettingsEnablePlugin(project.cwd, "keep-plugin");

    await getRunUninstall()({
      cwd: project.cwd,
      packages: ["my-plugin"],
      names: ["my-plugin"],
    });

    const settings = readJson(settingsPath(project.cwd));
    expect(settings.theme).toBe("keep-me");
    expect((settings.enabledPlugins as Record<string, unknown>)["hand@other"]).toBe(true);
    expect((settings.enabledPlugins as Record<string, unknown>)["my-plugin@apm"]).not.toBe(true);
    expect((settings.enabledPlugins as Record<string, unknown>)["keep-plugin@apm"]).toBe(true);

    const catalog = readFileSync(marketplacePath(project.cwd), "utf8");
    expect(catalog).toMatch(/keep-plugin/);
    expect(catalog).not.toMatch(/"my-plugin"|name"\s*:\s*"my-plugin"/);
  });

  test("uninstall of last plugin deletes generated catalog artifacts", async () => {
    project = createTempProject("bapm-cnap-empty-");
    writePortablePlugin(join(project.cwd, "plugin"), {
      pluginName: "my-plugin",
      packageName: "my-plugin",
      withApmYml: true,
    });
    writeConsumerManifest(project);
    await installForCopilot(project);
    expect(existsSync(marketplacePath(project.cwd))).toBe(true);

    await getRunUninstall()({
      cwd: project.cwd,
      packages: ["my-plugin"],
      names: ["my-plugin"],
    });

    expect(existsSync(marketplacePath(project.cwd))).toBe(false);
    expect(existsSync(ledgerPath(project.cwd))).toBe(false);
  });

  test("dry-run uninstall leaves registration untouched", async () => {
    project = createTempProject("bapm-cnap-undry-");
    writePortablePlugin(join(project.cwd, "plugin"), {
      pluginName: "my-plugin",
      packageName: "my-plugin",
      withApmYml: true,
    });
    writeConsumerManifest(project);
    await installForCopilot(project);

    const marketBefore = readFileSync(marketplacePath(project.cwd), "utf8");
    const ledgerBefore = readFileSync(ledgerPath(project.cwd), "utf8");
    const settingsBefore = readFileSync(settingsPath(project.cwd), "utf8");

    await getRunUninstall()({
      cwd: project.cwd,
      packages: ["my-plugin"],
      names: ["my-plugin"],
      dryRun: true,
      "dry-run": true,
    });

    expect(readFileSync(marketplacePath(project.cwd), "utf8")).toBe(marketBefore);
    expect(readFileSync(ledgerPath(project.cwd), "utf8")).toBe(ledgerBefore);
    expect(readFileSync(settingsPath(project.cwd), "utf8")).toBe(settingsBefore);
  });

  test("prune dry-run leaves registration untouched", async () => {
    project = createTempProject("bapm-cnap-prunedry-");
    writePortablePlugin(join(project.cwd, "plugin"), {
      pluginName: "my-plugin",
      packageName: "my-plugin",
      withApmYml: true,
    });
    writeConsumerManifest(project);
    await installForCopilot(project);
    const marketBefore = readFileSync(marketplacePath(project.cwd), "utf8");

    // Seed orphan module so prune has work in dry-run
    writeText(join(project.cwd, "apm_modules", "orphan-cli", "x.txt"), "x\n");

    await getRunPrune()({ cwd: project.cwd, dryRun: true, "dry-run": true });

    expect(readFileSync(marketplacePath(project.cwd), "utf8")).toBe(marketBefore);
    expect(existsSync(join(project.cwd, "apm_modules", "orphan-cli", "x.txt"))).toBe(true);
  });
});
