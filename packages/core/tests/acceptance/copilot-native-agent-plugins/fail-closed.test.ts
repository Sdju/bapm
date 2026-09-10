/**
 * Fail-closed: invalid settings JSON, marketplace ownership collision,
 * same-precedence plugin name collision, invalid portable admission.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectRejectsMatching,
  installForCopilot,
  ledgerPath,
  lockExists,
  marketplacePath,
  settingsPath,
  writeConsumerManifest,
  writeJson,
  writePortablePlugin,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("copilot native registration fail-closed", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("invalid settings JSON fails closed without overwrite", async () => {
    project = createTempProject("bapm-cnap-badjson-");
    const plugin = join(project.cwd, "plugin");
    writePortablePlugin(plugin, { pluginName: "my-plugin" });
    writeConsumerManifest(project);
    const settings = settingsPath(project.cwd);
    const original = '{\n  // jsonc not allowed\n  "theme": "x"\n}\n';
    writeText(settings, original);

    await expectRejectsMatching(
      () => installForCopilot(project!),
      /json|settings|invalid|parse|comment/i,
    );

    expect(readFileSync(settings, "utf8")).toBe(original);
    expect(existsSync(marketplacePath(project.cwd))).toBe(false);
  });

  test("conflicting unowned apm marketplace path is refused", async () => {
    project = createTempProject("bapm-cnap-collision-");
    const plugin = join(project.cwd, "plugin");
    writePortablePlugin(plugin, { pluginName: "my-plugin" });
    writeConsumerManifest(project);
    writeJson(settingsPath(project.cwd), {
      extraKnownMarketplaces: {
        apm: { source: { source: "directory", path: "someone-elses-modules" } },
      },
      keep: true,
    });
    const before = readFileSync(settingsPath(project.cwd), "utf8");

    await expectRejectsMatching(
      () => installForCopilot(project!),
      /marketplace|collision|ownership|apm_modules|conflict|refuse/i,
    );

    expect(readFileSync(settingsPath(project.cwd), "utf8")).toBe(before);
    const settings = JSON.parse(before) as {
      extraKnownMarketplaces: { apm: { source: { path: string } } };
    };
    expect(settings.extraKnownMarketplaces.apm.source.path).toBe("someone-elses-modules");
  });

  test("same-precedence portable plugin name collision fails closed", async () => {
    project = createTempProject("bapm-cnap-name-col-");
    writePortablePlugin(join(project.cwd, "a"), {
      pluginName: "dup",
      packageName: "pkg-a",
      withApmYml: true,
    });
    writePortablePlugin(join(project.cwd, "b"), {
      pluginName: "dup",
      packageName: "pkg-b",
      withApmYml: true,
    });
    writeConsumerManifest(project, {
      name: "name-collision",
      pluginRel: ["./a", "./b"],
    });

    await expectRejectsMatching(
      () => installForCopilot(project!),
      /dup|collision|conflict|plugin name|same.?precedence/i,
    );

    expect(existsSync(marketplacePath(project.cwd))).toBe(false);
    expect(existsSync(ledgerPath(project.cwd))).toBe(false);
    if (existsSync(settingsPath(project.cwd))) {
      const settings = JSON.parse(readFileSync(settingsPath(project.cwd), "utf8")) as {
        enabledPlugins?: Record<string, unknown>;
      };
      expect(settings.enabledPlugins?.["dup@apm"]).not.toBe(true);
    }
  });

  test("invalid portable Agent Plugin root aborts before successful lock commit", async () => {
    project = createTempProject("bapm-cnap-invalid-");
    const plugin = join(project.cwd, "plugin");
    writeText(
      join(plugin, "plugin.json"),
      JSON.stringify({
        $schema: "https://example.test/not-agent-plugins.json",
        name: "broken-plugin",
        version: "1.0.0",
      }),
    );
    writeText(
      join(plugin, "apm.yml"),
      "name: broken-pkg\nversion: 0.0.1\ndependencies:\n  apm: []\n",
    );
    writeText(join(plugin, "skills", "hello", "SKILL.md"), "---\nname: hello\n---\n# Hello\n");
    writeConsumerManifest(project, { name: "invalid-portable" });

    await expect(installForCopilot(project)).rejects.toThrow(
      /portable|agent.?plugin|plugin\.json|schema|invalid|admit|registration/i,
    );

    // Must not claim native registration artifacts on failure.
    expect(existsSync(marketplacePath(project.cwd))).toBe(false);
    expect(existsSync(ledgerPath(project.cwd))).toBe(false);
  });

  test("registration fail-closed aborts lock-committing install presentation", async () => {
    project = createTempProject("bapm-cnap-abort-lock-");
    const plugin = join(project.cwd, "plugin");
    writePortablePlugin(plugin, { pluginName: "my-plugin" });
    writeConsumerManifest(project);
    writeText(settingsPath(project.cwd), "{ not-json ");

    await expect(installForCopilot(project)).rejects.toThrow();
    // Either no lock, or install must not report ok with registration success.
    // Prefer no successful registration artifacts.
    expect(existsSync(marketplacePath(project.cwd))).toBe(false);
    expect(lockExists(project.cwd)).toBe(false);
  });
});
