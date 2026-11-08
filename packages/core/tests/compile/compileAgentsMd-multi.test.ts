/**
 * Core multi-target compile: `forcedTargets` / `all`, per-host outputs,
 * and fail-closed output-path collision policy.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { compileAgentsMd } from "../../src/index.ts";
import { createIntegrationRegistry } from "@b-apm/integration-api";

type TempProject = { cwd: string; cleanup: () => void };

function createTempProject(): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-compile-multi-"));
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

function writeCompileProject(cwd: string): void {
  mkdirSync(join(cwd, ".cursor"), { recursive: true });
  writeText(
    join(cwd, "bapm.yml"),
    "name: compile-multi\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm: []\n",
  );
  writeText(join(cwd, ".apm", "instructions", "style.md"), "# Style\nPrefer concise answers.\n");
}

function compileHost(id: string, defaultPath: string) {
  return {
    id,
    deployRoots: [],
    detect: () => true,
    materialize: () => {},
    compile: async (
      _primitives: unknown,
      context: { cwd: string; outputFile?: string; write: boolean },
    ) => {
      const path = context.outputFile ?? defaultPath;
      const content = `# ${id}\n`;
      if (context.write) writeText(join(context.cwd, path), content);
      return { path, content, wrote: context.write };
    },
  };
}

function registryWith(...hosts: Array<ReturnType<typeof compileHost>>) {
  const registry = createIntegrationRegistry();
  for (const host of hosts) registry.register(host);
  return registry;
}

describe("compileAgentsMd multi-target", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("forcedTargets writes one output per host in one invocation", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);

    const result = await compileAgentsMd({
      cwd: project.cwd,
      forcedTargets: ["cursor", "claude"],
      integrationRegistry: registryWith(
        compileHost("cursor", "AGENTS.md"),
        compileHost("claude", "CLAUDE.md"),
      ),
    });

    expect(result.ok).toBe(true);
    expect(result.wrote).toBe(true);
    expect(result.outputs).toEqual([
      { targetId: "cursor", path: "AGENTS.md", wrote: true },
      { targetId: "claude", path: "CLAUDE.md", wrote: true },
    ]);
    expect(result.path).toBe("AGENTS.md");
    expect(result.content).toBe("# cursor\n");
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(project.cwd, "CLAUDE.md"))).toBe(true);
  });

  test("single target keeps legacy result fields and one output entry", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);

    const result = await compileAgentsMd({
      cwd: project.cwd,
      forcedTarget: "cursor",
      integrationRegistry: registryWith(compileHost("cursor", "AGENTS.md")),
    });

    expect(result.path).toBe("AGENTS.md");
    expect(result.content).toBe("# cursor\n");
    expect(result.wrote).toBe(true);
    expect(result.outputs).toEqual([{ targetId: "cursor", path: "AGENTS.md", wrote: true }]);
  });

  test("dryRun previews every target without writing", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);

    const result = await compileAgentsMd({
      cwd: project.cwd,
      dryRun: true,
      forcedTargets: ["cursor", "claude"],
      integrationRegistry: registryWith(
        compileHost("cursor", "AGENTS.md"),
        compileHost("claude", "CLAUDE.md"),
      ),
    });

    expect(result.wrote).toBe(false);
    expect(result.outputs.map((output) => output.path)).toEqual(["AGENTS.md", "CLAUDE.md"]);
    expect(result.outputs.every((output) => output.wrote === false)).toBe(true);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(project.cwd, "CLAUDE.md"))).toBe(false);
  });

  test("two hosts sharing one output path fail closed without writing anything", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);

    await expect(
      compileAgentsMd({
        cwd: project.cwd,
        forcedTargets: ["cursor", "codex", "claude"],
        integrationRegistry: registryWith(
          compileHost("cursor", "AGENTS.md"),
          compileHost("codex", "AGENTS.md"),
          compileHost("claude", "CLAUDE.md"),
        ),
      }),
    ).rejects.toThrow(/"cursor".*"codex".*AGENTS\.md/s);

    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(project.cwd, "CLAUDE.md"))).toBe(false);
  });

  test("all selects every compile-capable target and skips non-compile hosts", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);

    const registry = registryWith(
      compileHost("cursor", "AGENTS.md"),
      compileHost("claude", "CLAUDE.md"),
      compileHost("gemini", "GEMINI.md"),
    );
    registry.register({
      id: "windsurf",
      deployRoots: [],
      detect: () => true,
      materialize: () => {},
    });

    const result = await compileAgentsMd({
      cwd: project.cwd,
      all: true,
      integrationRegistry: registry,
    });

    expect(result.outputs.map((output) => output.targetId)).toEqual(["cursor", "claude", "gemini"]);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(project.cwd, "CLAUDE.md"))).toBe(true);
    expect(existsSync(join(project.cwd, "GEMINI.md"))).toBe(true);
  });

  test("all fails closed when registered hosts collide on AGENTS.md", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);

    await expect(
      compileAgentsMd({
        cwd: project.cwd,
        all: true,
        integrationRegistry: registryWith(
          compileHost("cursor", "AGENTS.md"),
          compileHost("codex", "AGENTS.md"),
          compileHost("claude", "CLAUDE.md"),
        ),
      }),
    ).rejects.toThrow(/"cursor", "codex".*AGENTS\.md/s);

    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(project.cwd, "CLAUDE.md"))).toBe(false);
  });

  test("multiple targets reject a shared outputFile override", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);

    await expect(
      compileAgentsMd({
        cwd: project.cwd,
        forcedTargets: ["cursor", "claude"],
        outputFile: "OUT.md",
        integrationRegistry: registryWith(
          compileHost("cursor", "AGENTS.md"),
          compileHost("claude", "CLAUDE.md"),
        ),
      }),
    ).rejects.toThrow(/multiple targets.*output path|Multiple compile targets/i);

    expect(existsSync(join(project.cwd, "OUT.md"))).toBe(false);
  });

  test("all with no compile-capable targets fails with guidance", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);

    await expect(
      compileAgentsMd({
        cwd: project.cwd,
        all: true,
        integrationRegistry: createIntegrationRegistry(),
      }),
    ).rejects.toThrow(/no registered compile-capable targets/i);
  });
});
