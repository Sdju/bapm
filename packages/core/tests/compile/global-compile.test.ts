/**
 * Core user-scope (`compile --global`) contract:
 * - manifestCwd discovers primitives from the global root
 * - deployCwd writes supported hosts under the user home
 * - project files stay untouched; unsupported hosts fail closed
 * - global clean scans only selected home harness roots
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { compileAgentsMd } from "../../src/index.ts";
import {
  applyBuildId,
  createIntegrationRegistry,
  type BapmIntegration,
} from "@b-apm/integration-api";
import { createClaudeIntegration } from "../../../integration-claude/src/index.ts";
import { createCodexIntegration } from "../../../integration-codex/src/index.ts";
import { createCursorIntegration } from "../../../integration-cursor/src/index.ts";

type TempDir = { cwd: string; cleanup: () => void };

function createTempDir(prefix: string): TempDir {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

function writeGlobalInstruction(
  root: string,
  contents = "# Style\nPrefer concise answers.\n",
): void {
  writeText(join(root, ".apm", "instructions", "style.md"), contents);
}

function globalRegistry(...hosts: BapmIntegration[]) {
  const registry = createIntegrationRegistry();
  for (const host of hosts) registry.register(host);
  return registry;
}

describe("compileAgentsMd global scope", () => {
  let globalRoot: TempDir | undefined;
  let home: TempDir | undefined;

  afterEach(() => {
    globalRoot?.cleanup();
    home?.cleanup();
    globalRoot = undefined;
    home = undefined;
  });

  test("Cursor/Claude/Codex write home files; global root stays untouched", async () => {
    globalRoot = createTempDir("bapm-core-compile-global-root-");
    home = createTempDir("bapm-core-compile-global-home-");
    writeGlobalInstruction(globalRoot.cwd);
    const registry = globalRegistry(
      createCursorIntegration(),
      createClaudeIntegration(),
      createCodexIntegration(),
    );

    const result = await compileAgentsMd({
      cwd: globalRoot.cwd,
      manifestCwd: globalRoot.cwd,
      deployCwd: home.cwd,
      scope: "global",
      forcedTargets: ["cursor", "claude", "codex"],
      integrationRegistry: registry,
    });

    expect(result.wrote).toBe(true);
    expect(result.outputs.map((output) => output.path)).toEqual([
      ".cursor/AGENTS.md",
      ".claude/CLAUDE.md",
      ".codex/AGENTS.md",
    ]);
    for (const rel of [".cursor/AGENTS.md", ".claude/CLAUDE.md", ".codex/AGENTS.md"]) {
      expect(existsSync(join(home.cwd, rel)), rel).toBe(true);
      expect(readFileSync(join(home.cwd, rel), "utf8")).toMatch(/concise/i);
    }

    expect(existsSync(join(globalRoot.cwd, ".cursor"))).toBe(false);
    expect(existsSync(join(globalRoot.cwd, ".claude"))).toBe(false);
    expect(existsSync(join(globalRoot.cwd, ".codex"))).toBe(false);
    expect(existsSync(join(globalRoot.cwd, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(globalRoot.cwd, "CLAUDE.md"))).toBe(false);
  });

  test("global distributed and multi-target keep distinct home-root paths", async () => {
    globalRoot = createTempDir("bapm-core-compile-global-distributed-");
    home = createTempDir("bapm-core-compile-global-distributed-home-");
    writeText(
      join(globalRoot.cwd, ".apm", "instructions", "src.md"),
      "---\napplyTo: src/**\n---\n# Source rule\nScoped detail.\n",
    );
    const registry = globalRegistry(createCursorIntegration(), createClaudeIntegration());

    const result = await compileAgentsMd({
      cwd: globalRoot.cwd,
      manifestCwd: globalRoot.cwd,
      deployCwd: home.cwd,
      scope: "global",
      forcedTargets: ["cursor", "claude"],
      distributed: true,
      integrationRegistry: registry,
    });

    expect(result.outputs.map((output) => output.path)).toEqual([
      ".cursor/src/AGENTS.md",
      ".claude/src/CLAUDE.md",
    ]);
    expect(existsSync(join(home.cwd, ".cursor", "src", "AGENTS.md"))).toBe(true);
    expect(existsSync(join(home.cwd, ".claude", "src", "CLAUDE.md"))).toBe(true);
    expect(existsSync(join(globalRoot.cwd, ".cursor"))).toBe(false);
  });

  test("a compile-capable host without a user-scope path fails closed", async () => {
    globalRoot = createTempDir("bapm-core-compile-global-unsupported-");
    home = createTempDir("bapm-core-compile-global-unsupported-home-");
    writeGlobalInstruction(globalRoot.cwd);
    const projectOnly: BapmIntegration = {
      id: "x-project-only",
      deployRoots: [".project-only"],
      detect: () => true,
      materialize: () => {},
      compile: async () => ({ path: "HOST.md", content: "", wrote: false }),
    };

    await expect(
      compileAgentsMd({
        cwd: globalRoot.cwd,
        manifestCwd: globalRoot.cwd,
        deployCwd: home.cwd,
        scope: "global",
        forcedTarget: "x-project-only",
        integrationRegistry: globalRegistry(projectOnly),
      }),
    ).rejects.toThrow(/Global compile is not supported.*x-project-only/i);
    expect(existsSync(join(home.cwd, "HOST.md"))).toBe(false);
  });

  test("global clean only removes stale outputs inside selected home harness roots", async () => {
    globalRoot = createTempDir("bapm-core-compile-global-clean-");
    home = createTempDir("bapm-core-compile-global-clean-home-");
    writeGlobalInstruction(globalRoot.cwd);
    const registry = globalRegistry(createCursorIntegration());
    const options = {
      cwd: globalRoot.cwd,
      manifestCwd: globalRoot.cwd,
      deployCwd: home.cwd,
      scope: "global" as const,
      forcedTarget: "cursor",
      integrationRegistry: registry,
    };

    await compileAgentsMd(options);
    writeText(
      join(home.cwd, ".cursor", "old", "AGENTS.md"),
      applyBuildId("# stale\n\nOld generated output.\n"),
    );
    // A generated AGENTS.md at the home root is not a Cursor shape and must not
    // be scanned by the narrowed global clean.
    writeText(join(home.cwd, "AGENTS.md"), applyBuildId("# outside\n\nNot cursor.\n"));

    const result = await compileAgentsMd({ ...options, clean: true });

    expect(result.clean?.removed).toEqual([".cursor/old/AGENTS.md"]);
    expect(existsSync(join(home.cwd, ".cursor", "old", "AGENTS.md"))).toBe(false);
    expect(existsSync(join(home.cwd, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(home.cwd, ".cursor", "AGENTS.md"))).toBe(true);
  });

  test("project compile remains cwd-scoped", async () => {
    globalRoot = createTempDir("bapm-core-compile-project-");
    home = createTempDir("bapm-core-compile-project-home-");
    writeGlobalInstruction(globalRoot.cwd);
    const registry = globalRegistry(createCursorIntegration());

    await compileAgentsMd({
      cwd: globalRoot.cwd,
      forcedTarget: "cursor",
      integrationRegistry: registry,
    });

    expect(existsSync(join(globalRoot.cwd, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(home.cwd, ".cursor", "AGENTS.md"))).toBe(false);
  });
});
