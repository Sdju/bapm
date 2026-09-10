/**
 * Happy-path Copilot native registration: catalog, ledger, settings merge.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectCatalogListsPlugin,
  expectNoPrivateCopilotPluginCopy,
  expectSettingsEnablePlugin,
  installForCopilot,
  ledgerPath,
  listUnderModules,
  marketplacePath,
  readJson,
  settingsPath,
  writeConsumerManifest,
  writeJson,
  writePortablePlugin,
  writeText,
  type TempProject,
} from "./copilot-native-helpers.ts";

describe("copilot native registration happy path", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("install --target copilot registers portable plugin under apm_modules with catalog+ledger+settings", async () => {
    project = createTempProject("bapm-cnap-happy-");
    const plugin = join(project.cwd, "plugin");
    writePortablePlugin(plugin, { pluginName: "my-plugin", skill: "hello" });
    writeConsumerManifest(project, { name: "happy-reg", pluginRel: "./plugin" });

    await installForCopilot(project);

    const modulesFiles = listUnderModules(project.cwd);
    expect(modulesFiles.some((f) => f.endsWith("plugin.json"))).toBe(true);
    expect(modulesFiles.some((f) => f.endsWith("skills/hello/SKILL.md"))).toBe(true);
    expectNoPrivateCopilotPluginCopy(project.cwd);

    expectCatalogListsPlugin(project.cwd, "my-plugin");
    expectSettingsEnablePlugin(project.cwd, "my-plugin");

    const settings = readJson(settingsPath(project.cwd));
    const market = settings.extraKnownMarketplaces as Record<string, unknown>;
    expect(JSON.stringify(market.apm)).toMatch(/directory/);
  });

  test("settings merge preserves unrelated keys", async () => {
    project = createTempProject("bapm-cnap-preserve-");
    const plugin = join(project.cwd, "plugin");
    writePortablePlugin(plugin, { pluginName: "my-plugin" });
    writeConsumerManifest(project);
    writeJson(settingsPath(project.cwd), {
      theme: "dark",
      enabledPlugins: { "other@marketplace": true },
      nested: { keep: 1 },
    });

    await installForCopilot(project);

    const settings = readJson(settingsPath(project.cwd));
    expect(settings.theme).toBe("dark");
    expect(settings.nested).toEqual({ keep: 1 });
    expect((settings.enabledPlugins as Record<string, unknown>)["other@marketplace"]).toBe(true);
    expectSettingsEnablePlugin(project.cwd, "my-plugin");
  });

  test("matching apm marketplace is re-adopted when ledger is missing", async () => {
    project = createTempProject("bapm-cnap-readopt-");
    const plugin = join(project.cwd, "plugin");
    writePortablePlugin(plugin, { pluginName: "my-plugin" });
    writeConsumerManifest(project);
    writeJson(settingsPath(project.cwd), {
      extraKnownMarketplaces: {
        apm: { source: { source: "directory", path: "apm_modules" } },
      },
    });
    expect(existsSync(ledgerPath(project.cwd))).toBe(false);

    await installForCopilot(project);

    expect(existsSync(ledgerPath(project.cwd))).toBe(true);
    expectSettingsEnablePlugin(project.cwd, "my-plugin");
    expect(existsSync(marketplacePath(project.cwd))).toBe(true);
  });

  test("registration completes without invoking a Copilot binary on PATH", async () => {
    project = createTempProject("bapm-cnap-nobin-");
    const plugin = join(project.cwd, "plugin");
    writePortablePlugin(plugin, { pluginName: "my-plugin" });
    writeConsumerManifest(project);

    const marker = join(project.cwd, "copilot-invoked.marker");
    const binDir = join(project.cwd, ".fake-bin");
    writeText(join(binDir, "copilot"), `#!/bin/sh\necho invoked > "${marker}"\nexit 0\n`);
    // executable bit best-effort; spawn would still find the name
    const { chmodSync } = await import("node:fs");
    try {
      chmodSync(join(binDir, "copilot"), 0o755);
    } catch {
      /* ignore */
    }

    const prevPath = process.env.PATH;
    process.env.PATH = `${binDir}${prevPath ? `:${prevPath}` : ""}`;
    try {
      await installForCopilot(project);
    } finally {
      process.env.PATH = prevPath;
    }

    expect(existsSync(marker)).toBe(false);
    expectCatalogListsPlugin(project.cwd, "my-plugin");
    expectSettingsEnablePlugin(project.cwd, "my-plugin");
  });
});
