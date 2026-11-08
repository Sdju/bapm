/**
 * Claude Code plugin bundle packaging (`pack --format claude-plugin`).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractPackArchive, runPack } from "@b-apm/core";
import {
  createTempProject,
  expectRejectsMatching,
  writeConformingManifest,
  writeText,
} from "./helpers.ts";

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

const COMMAND = "---\ndescription: ship\n---\n# Ship\n";
const HOOK =
  '{"hooks":{"SessionStart":[{"matcher":"*","hooks":[{"type":"command","command":"./hooks/run.sh"}]}]}}\n';
const SCRIPT = "#!/bin/sh\necho hook\n";
const SKILL = "---\nname: hello\n---\n# Hello\n";
const GUIDE = "# Guide\n\nAuxiliary skill asset.\n";
const PROMPT = "hook sibling asset\n";

function writeClaudeTree(root: string): Record<string, string> {
  const pluginJson = `${JSON.stringify(
    {
      name: "claude-bundle",
      version: "1.0.0",
      description: "Claude plugin fixture",
      commands: ["./commands/ship.md"],
      hooks: ["./hooks/session.json"],
      skills: ["hello"],
    },
    null,
    2,
  )}\n`;
  const tree: Record<string, string> = {
    "plugin.json": pluginJson,
    "commands/ship.md": COMMAND,
    "commands/extra.md": "# Undeclared command preserved\n",
    "hooks/session.json": HOOK,
    "hooks/run.sh": SCRIPT,
    "hooks/assets/prompt.txt": PROMPT,
    "skills/hello/SKILL.md": SKILL,
    "skills/hello/references/guide.md": GUIDE,
    "agents/reviewer.md": "# Reviewer\n",
    "README.md": "# Claude bundle\n",
  };
  for (const [relativePath, contents] of Object.entries(tree)) {
    writeText(join(root, relativePath), contents);
  }
  return tree;
}

describe("pack --format claude-plugin", () => {
  test("packs plugin tree, native manifest, and round-trips declared components", async () => {
    const source = tempDir("bapm-claude-pack");
    const tree = writeClaudeTree(source);

    const packed = await runPack({
      cwd: source,
      archive: true,
      format: "claude-plugin",
      outputPath: join(source, "claude-bundle-1.0.0.zip"),
    });
    expect(packed.archivePath).toBeTruthy();
    expect(existsSync(packed.archivePath!)).toBe(true);

    const extracted = tempDir("bapm-claude-extract");
    await extractPackArchive({ archivePath: packed.archivePath, outputDir: extracted });

    for (const [relativePath, expected] of Object.entries(tree)) {
      expect(readFileSync(join(extracted, relativePath), "utf8"), relativePath).toBe(expected);
    }

    const native = JSON.parse(
      readFileSync(join(extracted, ".claude-plugin/plugin.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(native.name).toBe("claude-bundle");
    expect(native.hooks).toEqual(["./hooks/session.json"]);
    const root = JSON.parse(readFileSync(join(extracted, "plugin.json"), "utf8")) as Record<
      string,
      unknown
    >;
    expect(root).toEqual(native);
  });

  test("synthesizes native manifest from bapm.yml when no plugin.json exists", async () => {
    const project = createTempProject("bapm-claude-synth-");
    cleanup.push(project.cwd);
    writeConformingManifest(project.cwd, { name: "synthesized", version: "2.0.0" });
    writeText(join(project.cwd, "commands/ship.md"), COMMAND);

    const packed = await runPack({
      cwd: project.cwd,
      archive: true,
      format: "claude",
      outputPath: join(project.cwd, "synthesized-2.0.0.zip"),
    });
    const extracted = tempDir("bapm-claude-synth-extract");
    await extractPackArchive({ archivePath: packed.archivePath, outputDir: extracted });

    const native = JSON.parse(
      readFileSync(join(extracted, ".claude-plugin/plugin.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(native.name).toBe("synthesized");
    expect(native.version).toBe("2.0.0");
    expect(existsSync(join(extracted, "bapm.yml"))).toBe(false);
  });

  test("missing declared command fails closed before writing a zip", async () => {
    const source = tempDir("bapm-claude-missing");
    writeText(
      join(source, "plugin.json"),
      `${JSON.stringify({ name: "missing", version: "1.0.0", commands: ["./commands/absent.md"] })}\n`,
    );
    writeText(join(source, "README.md"), "# Missing\n");

    await expectRejectsMatching(
      () =>
        runPack({
          cwd: source,
          archive: true,
          format: "claude-plugin",
          outputPath: join(source, "missing-1.0.0.zip"),
        }),
      /absent|missing|commands|declared/i,
    );
    expect(existsSync(join(source, "missing-1.0.0.zip"))).toBe(false);
  });

  test("declared path traversal fails closed", async () => {
    const source = tempDir("bapm-claude-traversal");
    const outside = join(source, "..", `outside-${Date.now()}.json`);
    writeText(outside, HOOK);
    cleanup.push(outside);
    writeText(
      join(source, "plugin.json"),
      `${JSON.stringify({ name: "traversal", version: "1.0.0", hooks: ["../outside.json"] })}\n`,
    );

    await expectRejectsMatching(
      () =>
        runPack({
          cwd: source,
          archive: true,
          format: "claude-plugin",
          outputPath: join(source, "traversal-1.0.0.zip"),
        }),
      /escape|traversal|outside|declared/i,
    );
    expect(existsSync(join(source, "traversal-1.0.0.zip"))).toBe(false);
  });

  test("symbolic-link entries are rejected before writing a zip", async () => {
    const source = tempDir("bapm-claude-symlink");
    writeText(
      join(source, "plugin.json"),
      `${JSON.stringify({
        name: "symlink",
        version: "1.0.0",
        commands: ["./commands/link.md"],
      })}\n`,
    );
    writeText(join(source, "commands/real.md"), COMMAND);
    symlinkSync("real.md", join(source, "commands/link.md"));

    await expectRejectsMatching(
      () =>
        runPack({
          cwd: source,
          archive: true,
          format: "claude-plugin",
          outputPath: join(source, "symlink-1.0.0.zip"),
        }),
      /symbolic|symlink|unsafe/i,
    );
    expect(existsSync(join(source, "symlink-1.0.0.zip"))).toBe(false);
  });

  test("default pack remains a plain APM zip without a generated Claude manifest", async () => {
    const project = createTempProject("bapm-claude-default-");
    cleanup.push(project.cwd);
    writeConformingManifest(project.cwd, { name: "default-pack", version: "3.0.0" });
    writeText(join(project.cwd, "commands/ship.md"), COMMAND);

    const packed = await runPack({
      cwd: project.cwd,
      archive: true,
      outputPath: join(project.cwd, "default-pack-3.0.0.zip"),
    });
    const extracted = tempDir("bapm-claude-default-extract");
    await extractPackArchive({ archivePath: packed.archivePath, outputDir: extracted });

    expect(existsSync(join(extracted, "bapm.yml"))).toBe(true);
    expect(existsSync(join(extracted, ".claude-plugin/plugin.json"))).toBe(false);
  });
});
