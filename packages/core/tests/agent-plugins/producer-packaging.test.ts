/**
 * Portable Agent Plugins producer packaging: declared paths + sibling assets.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
  discoverAgentPluginDeclaredPaths,
  discoverAgentPluginSkills,
  extractPackArchive,
  loadAgentPluginManifest,
  runPack,
} from "@b-apm/core";

const cleanup: string[] = [];

afterEach(() => {
  while (cleanup.length > 0) rmSync(cleanup.pop()!, { recursive: true, force: true });
});

function tempDir(prefix: string): string {
  const path = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(path, { recursive: true });
  cleanup.push(path);
  return path;
}

function writeFile(root: string, relativePath: string, contents: string): void {
  const path = join(root, relativePath);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

function writePluginJson(root: string, extra: Record<string, unknown> = {}): string {
  const document = {
    $schema: AGENT_PLUGIN_MANIFEST_SCHEMA_V1,
    name: "portable-pack",
    version: "1.0.0",
    ...extra,
  };
  writeFile(join(root), "plugin.json", `${JSON.stringify(document, null, 2)}\n`);
  return `${JSON.stringify(document, null, 2)}\n`;
}

function expectNoZip(root: string): void {
  const path = join(root, "portable-pack-1.0.0.zip");
  expect(existsSync(path)).toBe(false);
}

const COMMAND = "---\ndescription: ship\n---\n# Ship\n";
const HOOK = `${JSON.stringify({ hooks: { sessionStart: [{ command: "./hooks/run.sh" }] } }, null, 2)}\n`;
const SCRIPT = "#!/bin/sh\necho hook\n";
const SKILL = "---\nname: hello\n---\n# Hello\n";
const GUIDE = "# Guide\n\nAuxiliary skill asset.\n";

function writePortableTree(root: string): void {
  writePluginJson(root, {
    commands: ["./commands/ship.md"],
    hooks: ["./hooks/session-start.json"],
    skills: ["hello"],
  });
  writeFile(root, "commands/ship.md", COMMAND);
  writeFile(root, "commands/extra.md", "# Undeclared command preserved\n");
  writeFile(root, "hooks/session-start.json", HOOK);
  writeFile(root, "hooks/extra.json", `${JSON.stringify({ hooks: {} }, null, 2)}\n`);
  writeFile(root, "hooks/run.sh", SCRIPT);
  writeFile(root, "hooks/lib/helper.sh", "#!/bin/sh\nexit 0\n");
  writeFile(root, "hooks/assets/prompt.txt", "hook sibling asset\n");
  writeFile(root, "skills/hello/SKILL.md", SKILL);
  writeFile(root, "skills/hello/references/guide.md", GUIDE);
  writeFile(root, "agents/reviewer.md", "# Reviewer\n");
  writeFile(
    root,
    "mcp.json",
    `${JSON.stringify({ mcpServers: { example: { type: "stdio", command: "node" } } }, null, 2)}\n`,
  );
  writeFile(
    root,
    ".claude-plugin/plugin.json",
    `${JSON.stringify({ name: "native-manifest" }, null, 2)}\n`,
  );
  writeFile(root, "README.md", "# Portable\n");
}

describe("Agent Plugins producer packaging", () => {
  test("packs declared commands/hooks/skills with sibling assets and round-trips", async () => {
    const source = tempDir("bapm-ap-pack");
    writePortableTree(source);
    const pluginJson = readFileSync(join(source, "plugin.json"), "utf8");

    const packed = await runPack({
      cwd: source,
      archive: true,
      agentPlugins: true,
      outputPath: join(source, "portable-pack-1.0.0.zip"),
    });
    expect(packed.archivePath).toBeTruthy();
    expect(existsSync(packed.archivePath!)).toBe(true);

    const extracted = tempDir("bapm-ap-extract");
    await extractPackArchive({ archivePath: packed.archivePath, outputDir: extracted });

    for (const [relativePath, expected] of [
      ["plugin.json", pluginJson],
      ["commands/ship.md", COMMAND],
      ["commands/extra.md", "# Undeclared command preserved\n"],
      ["hooks/session-start.json", HOOK],
      ["hooks/extra.json", `${JSON.stringify({ hooks: {} }, null, 2)}\n`],
      ["hooks/run.sh", SCRIPT],
      ["hooks/lib/helper.sh", "#!/bin/sh\nexit 0\n"],
      ["hooks/assets/prompt.txt", "hook sibling asset\n"],
      ["skills/hello/SKILL.md", SKILL],
      ["skills/hello/references/guide.md", GUIDE],
      ["agents/reviewer.md", "# Reviewer\n"],
    ] as const) {
      expect(readFileSync(join(extracted, relativePath), "utf8")).toBe(expected);
    }
    expect(readFileSync(join(extracted, "mcp.json"), "utf8")).toContain("example");
    expect(readFileSync(join(extracted, ".claude-plugin/plugin.json"), "utf8")).toContain(
      "native-manifest",
    );

    const declared = discoverAgentPluginDeclaredPaths({ root: extracted });
    expect(declared.commands.map((item) => item.declaredPath)).toEqual(["./commands/ship.md"]);
    expect(declared.hooks.map((item) => item.declaredPath)).toEqual(["./hooks/session-start.json"]);
    expect(
      discoverAgentPluginSkills({ root: extracted }).skills.map((skill) => skill.name),
    ).toEqual(["hello"]);

    // Repack the extracted root: the archive layout itself must stay portable.
    const repacked = await runPack({
      cwd: extracted,
      archive: true,
      agentPlugins: true,
      outputPath: join(extracted, "repacked.zip"),
    });
    const twice = tempDir("bapm-ap-extract-2");
    await extractPackArchive({ archivePath: repacked.archivePath, outputDir: twice });
    expect(loadAgentPluginManifest({ root: twice }).manifest.commands).toEqual([
      "./commands/ship.md",
    ]);
    expect(readFileSync(join(twice, "hooks/assets/prompt.txt"), "utf8")).toBe(
      "hook sibling asset\n",
    );
  });

  test("missing declared command fails closed before writing a zip", async () => {
    const source = tempDir("bapm-ap-missing");
    writePluginJson(source, { commands: ["./commands/absent.md"] });
    writeFile(source, "README.md", "# Portable\n");

    await expect(runPack({ cwd: source, archive: true, agentPlugins: true })).rejects.toThrow(
      /absent|missing|commands|declared/i,
    );
    expectNoZip(source);
  });

  test(".bapmignore can omit authoring files but not a declared command", async () => {
    const source = tempDir("bapm-ap-ignore");
    writePluginJson(source, { commands: ["./commands/ship.md"] });
    writeFile(source, "commands/ship.md", COMMAND);
    writeFile(source, "README.md", "# Omit me\n");
    writeFile(source, ".bapmignore", "README.md\n");

    const packed = await runPack({
      cwd: source,
      archive: true,
      agentPlugins: true,
      outputPath: join(source, "portable-pack-1.0.0.zip"),
    });
    const extracted = tempDir("bapm-ap-ignore-extract");
    await extractPackArchive({ archivePath: packed.archivePath, outputDir: extracted });
    expect(existsSync(join(extracted, "README.md"))).toBe(false);
    expect(existsSync(join(extracted, "commands/ship.md"))).toBe(true);

    const excluded = tempDir("bapm-ap-ignore-declared");
    writePluginJson(excluded, { commands: ["./commands/ship.md"] });
    writeFile(excluded, "commands/ship.md", COMMAND);
    writeFile(excluded, ".bapmignore", "commands/ship.md\n");

    await expect(runPack({ cwd: excluded, archive: true, agentPlugins: true })).rejects.toThrow(
      /pack set|excluded|bapmignore/i,
    );
    expectNoZip(excluded);
  });

  test(".bapmignore cannot strip a declared skill sibling asset", async () => {
    const source = tempDir("bapm-ap-skill-ignore");
    writePluginJson(source, { skills: ["hello"] });
    writeFile(source, "skills/hello/SKILL.md", SKILL);
    writeFile(source, "skills/hello/references/guide.md", GUIDE);
    writeFile(source, ".bapmignore", "skills/hello/references/guide.md\n");

    await expect(runPack({ cwd: source, archive: true, agentPlugins: true })).rejects.toThrow(
      /Declared skill|pack set|guide\.md/i,
    );
    expectNoZip(source);
  });

  test("declared path traversal fails closed", async () => {
    const source = tempDir("bapm-ap-traversal");
    writePluginJson(source, { hooks: ["../outside-hooks.json"] });
    const outside = join(source, "..", `outside-${Date.now()}.json`);
    writeFileSync(outside, HOOK, "utf8");
    cleanup.push(outside);

    await expect(runPack({ cwd: source, archive: true, agentPlugins: true })).rejects.toThrow(
      /escape|traversal|outside|declared/i,
    );
    expectNoZip(source);
  });

  test("symbolic-link entries are rejected before writing a zip", async () => {
    const source = tempDir("bapm-ap-symlink");
    writePluginJson(source, { commands: ["./commands/link.md"] });
    writeFile(source, "commands/real.md", COMMAND);
    symlinkSync("real.md", join(source, "commands/link.md"));

    await expect(runPack({ cwd: source, archive: true, agentPlugins: true })).rejects.toThrow(
      /symbolic|symlink|unsafe/i,
    );
    expectNoZip(source);
  });
});
