/**
 * Core compile Build ID + `clean` orphan removal.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { compileAgentsMd } from "../../src/index.ts";
import {
  applyBuildId,
  compileMarkdownReport,
  createIntegrationRegistry,
  primitivesList,
  renderPrimitivesMarkdown,
  type BapmIntegration,
} from "@b-apm/integration-api";

type TempProject = { cwd: string; cleanup: () => void };

function createTempProject(): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-compile-clean-"));
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

function writeProject(cwd: string): void {
  mkdirSync(join(cwd, ".cursor"), { recursive: true });
  writeText(
    join(cwd, "bapm.yml"),
    "name: compile-clean\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm: []\n",
  );
}

function writeInstruction(cwd: string, name: string, contents: string): void {
  writeText(join(cwd, ".apm", "instructions", name), contents);
}

function host(id: string, defaultPath: string): BapmIntegration {
  return {
    id,
    deployRoots: [],
    detect: () => true,
    materialize: () => {},
    compile: async (primitives, context) => {
      const content = renderPrimitivesMarkdown({
        primitives: primitivesList(primitives),
        title: `# ${id}`,
      });
      return compileMarkdownReport({
        cwd: context.cwd,
        outputFile: context.outputFile ?? defaultPath,
        write: context.write,
        content,
      });
    },
  };
}

function registryWith(...hosts: BapmIntegration[]) {
  const registry = createIntegrationRegistry();
  for (const item of hosts) registry.register(item);
  return registry;
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function readBuildId(content: string): string | undefined {
  return /^<!-- Build ID: ([0-9a-f]{12}) -->$/m.exec(content)?.[1];
}

describe("compileAgentsMd build id + clean", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("build id is stable across runs and changes with content", async () => {
    project = createTempProject();
    writeProject(project.cwd);
    writeInstruction(project.cwd, "style.md", "# Style\nPrefer concise answers.\n");
    const registry = registryWith(host("cursor", "AGENTS.md"));

    const opts = {
      cwd: project.cwd,
      forcedTarget: "cursor",
      integrationRegistry: registry,
    } as const;
    await compileAgentsMd(opts);
    const first = read(join(project.cwd, "AGENTS.md"));
    await compileAgentsMd(opts);
    const second = read(join(project.cwd, "AGENTS.md"));

    expect(second).toBe(first);
    expect(readBuildId(first)).toMatch(/^[0-9a-f]{12}$/);

    writeInstruction(project.cwd, "style.md", "# Style\nPrefer very concise answers.\n");
    await compileAgentsMd(opts);
    const changed = read(join(project.cwd, "AGENTS.md"));
    expect(changed).not.toBe(first);
    expect(readBuildId(changed)).not.toBe(readBuildId(first));
  });

  test("clean removes only stale generated outputs and protects manual or edited files", async () => {
    project = createTempProject();
    writeProject(project.cwd);
    writeInstruction(project.cwd, "style.md", "# Style\nCurrent rule.\n");
    const registry = registryWith(host("cursor", "AGENTS.md"));

    await compileAgentsMd({
      cwd: project.cwd,
      forcedTarget: "cursor",
      integrationRegistry: registry,
    });

    writeText(join(project.cwd, "docs", "AGENTS.md"), applyBuildId("# old\n\nStale.\n"));
    writeText(join(project.cwd, "legacy", "AGENTS.md"), "# manual\n\nHand authored.\n");
    const generated = applyBuildId("# old\n\nEdited later.\n");
    writeText(
      join(project.cwd, "edited", "AGENTS.md"),
      generated.replace("Edited later.", "Changed."),
    );

    const result = await compileAgentsMd({
      cwd: project.cwd,
      forcedTarget: "cursor",
      integrationRegistry: registry,
      clean: true,
    });

    expect(result.clean?.removed).toEqual(["docs/AGENTS.md"]);
    expect(result.clean?.wouldRemove).toEqual([]);
    expect(result.clean?.skipped).toContainEqual({
      path: "edited/AGENTS.md",
      reason: "modified",
    });
    expect(existsSync(join(project.cwd, "docs", "AGENTS.md"))).toBe(false);
    expect(existsSync(join(project.cwd, "legacy", "AGENTS.md"))).toBe(true);
    expect(existsSync(join(project.cwd, "edited", "AGENTS.md"))).toBe(true);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(true);
  });

  test("clean dry-run lists removals without deleting or writing", async () => {
    project = createTempProject();
    writeProject(project.cwd);
    writeInstruction(project.cwd, "style.md", "# Style\nCurrent rule.\n");
    const registry = registryWith(host("cursor", "AGENTS.md"));
    writeText(join(project.cwd, "docs", "AGENTS.md"), applyBuildId("# old\n\nStale.\n"));

    const result = await compileAgentsMd({
      cwd: project.cwd,
      forcedTarget: "cursor",
      integrationRegistry: registry,
      clean: true,
      dryRun: true,
    });

    expect(result.clean?.removed).toEqual([]);
    expect(result.clean?.wouldRemove).toEqual(["docs/AGENTS.md"]);
    expect(existsSync(join(project.cwd, "docs", "AGENTS.md"))).toBe(true);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });

  test("clean validate never deletes", async () => {
    project = createTempProject();
    writeProject(project.cwd);
    writeInstruction(project.cwd, "style.md", "# Style\nCurrent rule.\n");
    const registry = registryWith(host("cursor", "AGENTS.md"));
    writeText(join(project.cwd, "docs", "AGENTS.md"), applyBuildId("# old\n\nStale.\n"));

    const result = await compileAgentsMd({
      cwd: project.cwd,
      forcedTarget: "cursor",
      integrationRegistry: registry,
      clean: true,
      validate: true,
    });

    expect(result.clean).toBeUndefined();
    expect(existsSync(join(project.cwd, "docs", "AGENTS.md"))).toBe(true);
  });

  test("multi-target clean uses every selected host shape", async () => {
    project = createTempProject();
    writeProject(project.cwd);
    writeInstruction(project.cwd, "style.md", "# Style\nCurrent rule.\n");
    const registry = registryWith(
      host("cursor", "AGENTS.md"),
      host("claude", "CLAUDE.md"),
      host("gemini", "GEMINI.md"),
    );
    writeText(join(project.cwd, "docs", "AGENTS.md"), applyBuildId("# old cursor\n\nStale.\n"));
    writeText(join(project.cwd, "docs", "CLAUDE.md"), applyBuildId("# old claude\n\nStale.\n"));
    writeText(join(project.cwd, "docs", "GEMINI.md"), applyBuildId("# old gemini\n\nStale.\n"));

    const result = await compileAgentsMd({
      cwd: project.cwd,
      forcedTargets: ["cursor", "claude"],
      integrationRegistry: registry,
      clean: true,
    });

    expect(result.clean?.removed).toEqual(["docs/AGENTS.md", "docs/CLAUDE.md"]);
    expect(existsSync(join(project.cwd, "docs", "AGENTS.md"))).toBe(false);
    expect(existsSync(join(project.cwd, "docs", "CLAUDE.md"))).toBe(false);
    // Gemini was not selected, so its shape is out of scope.
    expect(existsSync(join(project.cwd, "docs", "GEMINI.md"))).toBe(true);
  });

  test("distributed clean removes a stale previous placement", async () => {
    project = createTempProject();
    writeProject(project.cwd);
    writeInstruction(
      project.cwd,
      "style.md",
      '---\ndescription: Style\napplyTo: "src/**"\n---\n\n# Style\nFirst placement.\n',
    );
    const registry = registryWith(host("cursor", "AGENTS.md"));

    await compileAgentsMd({
      cwd: project.cwd,
      forcedTarget: "cursor",
      integrationRegistry: registry,
      distributed: true,
    });
    expect(existsSync(join(project.cwd, "src", "AGENTS.md"))).toBe(true);

    writeInstruction(
      project.cwd,
      "style.md",
      '---\ndescription: Style\napplyTo: "docs/**"\n---\n\n# Style\nSecond placement.\n',
    );
    const result = await compileAgentsMd({
      cwd: project.cwd,
      forcedTarget: "cursor",
      integrationRegistry: registry,
      distributed: true,
      clean: true,
    });

    expect(result.clean?.removed).toEqual(["src/AGENTS.md"]);
    expect(existsSync(join(project.cwd, "src", "AGENTS.md"))).toBe(false);
    expect(existsSync(join(project.cwd, "docs", "AGENTS.md"))).toBe(true);
  });
});
