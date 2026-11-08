/**
 * CLI init --discover: read-only inventory, JSON contract, and safe --apply.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadManifest } from "@b-apm/core";
import {
  createTempProject,
  expectKnownCommand,
  runInProject,
  writeText,
  type TempProject,
} from "./helpers.ts";

function writeHarness(cwd: string): void {
  writeText(cwd, ".cursor/rules/style.mdc", "---\ndescription: style\n---\nUse tabs.\n");
  writeText(cwd, ".cursor/commands/run.md", "# Run\n");
  writeText(
    cwd,
    ".cursor/hooks.json",
    JSON.stringify({
      version: 1,
      hooks: { beforeShellExecution: [{ command: ".cursor/hooks/check.sh" }] },
    }),
  );
  writeText(
    cwd,
    ".cursor/mcp.json",
    JSON.stringify({ mcpServers: { demo: { command: "node", args: ["server.js"] } } }),
  );
  writeText(cwd, ".claude/rules/team.md", "# Team\n");
  writeText(
    cwd,
    ".claude/settings.json",
    JSON.stringify({
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [{ type: "command", command: ".claude/hooks/check.sh" }],
          },
        ],
      },
    }),
  );
  writeText(cwd, ".agents/skills/hello/SKILL.md", "---\nname: hello\n---\n# Hello\n");
}

type DiscoveryReportJson = {
  schemaVersion: number;
  cwd: string;
  manifest: { exists: boolean; path: string | null };
  hosts: Array<{ id: string; markers: string[] }>;
  suggestedActive: string[];
  counts: {
    hosts: number;
    skills: number;
    rules: number;
    commands: number;
    hooks: number;
    mcp: number;
  };
  inventory: Record<
    "skills" | "rules" | "commands" | "hooks" | "mcp",
    Array<{ path: string; host: string | null; name?: string }>
  >;
  applied: boolean;
  manifestPath?: string;
};

function parseJsonOutput(stdout: string[]): DiscoveryReportJson {
  const text = stdout.join("\n").trim();
  expect(text.startsWith("{")).toBe(true);
  return JSON.parse(text) as DiscoveryReportJson;
}

describe("CLI init --discover", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("empty project reports no hosts and writes nothing", async () => {
    project = createTempProject();
    const before = readdirSync(project.cwd);

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "init",
      "--discover",
      "--json",
    ]);
    expectKnownCommand(combined, "init");
    expect(result).toBe(0);

    const report = parseJsonOutput(stdout);
    expect(report.schemaVersion).toBe(1);
    expect(report.cwd).toBe(project.cwd);
    expect(report.manifest).toEqual({ exists: false, path: null });
    expect(report.hosts).toEqual([]);
    expect(report.suggestedActive).toEqual([]);
    expect(report.counts).toEqual({
      hosts: 0,
      skills: 0,
      rules: 0,
      commands: 0,
      hooks: 0,
      mcp: 0,
    });
    expect(report.applied).toBe(false);
    expect(existsSync(join(project.cwd, "bapm.yml"))).toBe(false);
    expect(readdirSync(project.cwd)).toEqual(before);
  });

  test("detects hosts and inventories skills, rules, commands, hooks, MCP", async () => {
    project = createTempProject();
    writeHarness(project.cwd);

    const hookPath = join(project.cwd, ".cursor/hooks.json");
    const hookMtime = statSync(hookPath).mtimeMs;

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "init",
      "--discover",
      "--json",
    ]);
    expectKnownCommand(combined, "init");
    expect(result).toBe(0);

    const report = parseJsonOutput(stdout);
    expect(report.manifest).toEqual({ exists: false, path: null });
    expect(report.hosts.map((host) => host.id)).toEqual(["claude", "cursor"]);
    expect(report.suggestedActive).toEqual(["claude", "cursor"]);
    expect(report.counts).toEqual({
      hosts: 2,
      skills: 1,
      rules: 2,
      commands: 1,
      hooks: 2,
      mcp: 1,
    });

    expect(report.inventory.skills[0].path).toBe(".agents/skills/hello/SKILL.md");
    expect(report.inventory.rules.map((entry: { path: string }) => entry.path)).toEqual([
      ".claude/rules/team.md",
      ".cursor/rules/style.mdc",
    ]);
    expect(report.inventory.commands[0].path).toBe(".cursor/commands/run.md");
    expect(report.inventory.hooks.map((entry: { path: string }) => entry.path)).toEqual([
      ".claude/settings.json",
      ".cursor/hooks.json",
    ]);
    expect(report.inventory.mcp[0]).toMatchObject({
      path: ".cursor/mcp.json",
      name: "demo",
    });

    // Preview must be read-only.
    expect(existsSync(join(project.cwd, "bapm.yml"))).toBe(false);
    expect(statSync(hookPath).mtimeMs).toBe(hookMtime);
  });

  test("human preview prints suggestions and a no-write notice", async () => {
    project = createTempProject();
    writeHarness(project.cwd);

    const { result, stdout, combined } = await runInProject(project.cwd, ["init", "--discover"]);
    expectKnownCommand(combined, "init");
    expect(result).toBe(0);
    const text = stdout.join("\n");
    expect(text).toMatch(/Detected hosts:/);
    expect(text).toMatch(/cursor/);
    expect(text).toMatch(/Suggested active: claude, cursor/);
    expect(text).toMatch(/No files were written/);
    expect(existsSync(join(project.cwd, "bapm.yml"))).toBe(false);
  });

  test("--discover --apply writes active targets and empty dependencies, preserving files", async () => {
    project = createTempProject();
    writeHarness(project.cwd);

    const { result, combined } = await runInProject(project.cwd, ["init", "--discover", "--apply"]);
    expectKnownCommand(combined, "init");
    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, "bapm.yml"))).toBe(true);

    const raw = readFileSync(join(project.cwd, "bapm.yml"), "utf8");
    expect(raw).not.toMatch(/^targets:/m);
    expect(raw).not.toMatch(/^target:/m);
    expect(raw).toMatch(/- target: claude/);
    expect(raw).toMatch(/- target: cursor/);

    const { document: doc } = loadManifest({ cwd: project.cwd });
    expect(doc.active).toEqual([
      { kind: "target", id: "claude", negate: false },
      { kind: "target", id: "cursor", negate: false },
    ]);
    expect(doc.dependencies).toMatchObject({ apm: [], mcp: [] });

    // Existing harness content is never deleted or moved.
    expect(existsSync(join(project.cwd, ".cursor/mcp.json"))).toBe(true);
    expect(existsSync(join(project.cwd, ".claude/settings.json"))).toBe(true);
    expect(existsSync(join(project.cwd, ".agents/skills/hello/SKILL.md"))).toBe(true);
  });

  test("--discover --apply --json reports applied true and the manifest path", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "init",
      "--discover",
      "--apply",
      "--json",
    ]);
    expectKnownCommand(combined, "init");
    expect(result).toBe(0);

    const report = parseJsonOutput(stdout);
    expect(report.applied).toBe(true);
    expect(report.manifestPath).toBe(join(project.cwd, "bapm.yml"));
    expect(report.manifest).toEqual({ exists: false, path: null });
    expect(report.suggestedActive).toEqual(["cursor"]);
  });

  test("--discover --apply refuses an existing bapm.yml without touching it", async () => {
    project = createTempProject();
    const path = join(project.cwd, "bapm.yml");
    const original = 'name: keep-me\nversion: "9.9.9"\n';
    writeFileSync(path, original, "utf8");

    const { result, stderr, combined } = await runInProject(project.cwd, [
      "init",
      "--discover",
      "--apply",
    ]);
    expectKnownCommand(combined, "init");
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/already exists|will not overwrite/i);
    expect(readFileSync(path, "utf8")).toBe(original);
  });

  test("--discover --apply refuses an existing apm.yml without creating bapm.yml", async () => {
    project = createTempProject();
    const path = join(project.cwd, "apm.yml");
    const original = 'name: keep-apm\nversion: "8.8.8"\n';
    writeFileSync(path, original, "utf8");

    const { result, stderr } = await runInProject(project.cwd, ["init", "--discover", "--apply"]);
    expect(result).not.toBe(0);
    expect(stderr.join("\n")).toMatch(/apm\.yml already exists|will not overwrite/i);
    expect(readFileSync(path, "utf8")).toBe(original);
    expect(existsSync(join(project.cwd, "bapm.yml"))).toBe(false);
  });

  test("--discover --apply in an empty project writes a minimal manifest without active", async () => {
    project = createTempProject();

    const { result } = await runInProject(project.cwd, ["init", "--discover", "--apply"]);
    expect(result).toBe(0);
    const raw = readFileSync(join(project.cwd, "bapm.yml"), "utf8");
    expect(raw).not.toMatch(/^active:/m);
    const { document: doc } = loadManifest({ cwd: project.cwd });
    expect(doc).not.toHaveProperty("active");
    expect(doc.dependencies).toMatchObject({ apm: [], mcp: [] });
  });

  test("--apply requires --discover and --discover rejects --target", async () => {
    project = createTempProject();

    const applyOnly = await runInProject(project.cwd, ["init", "--apply"]);
    expect(applyOnly.result).not.toBe(0);
    expect(applyOnly.stderr.join("\n")).toMatch(/--apply requires --discover/);

    const withTarget = await runInProject(project.cwd, [
      "init",
      "--discover",
      "--target",
      "cursor",
    ]);
    expect(withTarget.result).not.toBe(0);
    expect(withTarget.stderr.join("\n")).toMatch(/--target cannot be combined with --discover/);
    expect(existsSync(join(project.cwd, "bapm.yml"))).toBe(false);
  });

  test("init --help documents discovery and apply", async () => {
    project = createTempProject();
    const { result, stdout } = await runInProject(project.cwd, ["init", "--help"]);
    expect(result).toBe(0);
    const text = stdout.join("\n");
    expect(text).toMatch(/--discover/);
    expect(text).toMatch(/--json/);
    expect(text).toMatch(/--apply/);
  });
});
