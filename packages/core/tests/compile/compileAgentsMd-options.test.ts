/**
 * Unit: compileAgentsMd dryRun / validate / outputFile / attribution.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { compileAgentsMd } from "@bapm/core";
import { createIntegrationRegistry } from "bapm-integration-api";

type TempProject = { cwd: string; cleanup: () => void };

function createTempProject(): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-compile-unit-"));
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
    "name: compile-unit\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm: []\n",
  );
  writeText(join(cwd, ".apm", "instructions", "style.md"), "# Style\nPrefer concise answers.\n");
}

function compile(options: Parameters<typeof compileAgentsMd>[0]) {
  const registry = createIntegrationRegistry();
  registry.register({
    id: "test-host",
    deployRoots: [],
    detect: () => true,
    materialize: () => {},
    compile: async (_primitives, context) => {
      const path = context.outputFile ?? "AGENTS.md";
      const content = "# AGENTS.md\n";
      if (context.write) writeText(join(context.cwd, path), content);
      return { path, content, wrote: context.write };
    },
  });
  return compileAgentsMd({ ...options, integrationRegistry: registry });
}

describe("compileAgentsMd dryRun / validate / attribution", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("dryRun does not write", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);
    const result = await compile({ cwd: project.cwd, dryRun: true });
    expect(result.ok).toBe(true);
    expect(result.wrote).toBe(false);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });

  test("validate does not write", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);
    const result = await compile({ cwd: project.cwd, validate: true });
    expect(result.wrote).toBe(false);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });

  test("validate wins over dryRun (no write)", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);
    const result = await compile({ cwd: project.cwd, validate: true, dryRun: true });
    expect(result.ok).toBe(true);
    expect(result.wrote).toBe(false);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });

  test("custom outputFile writes that path", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);
    const outRel = join("nested", "OUT.md");
    const result = await compile({ cwd: project.cwd, outputFile: outRel });
    expect(result.wrote).toBe(true);
    expect(existsSync(join(project.cwd, outRel))).toBe(true);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });

  test("attribution includes name, type, path", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);
    const result = await compile({ cwd: project.cwd, dryRun: true, verbose: true });
    expect(result.attribution.length).toBeGreaterThan(0);
    const style = result.attribution.find(
      (e) => e.name.toLowerCase() === "style" || (e.path ?? "").includes("style.md"),
    );
    expect(style).toBeTruthy();
    expect(style!.type).toMatch(/instruction/i);
    expect(style!.path ?? "").toMatch(/style\.md/);
  });

  test("dryRun does not rewrite existing file", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);
    const agents = join(project.cwd, "AGENTS.md");
    writeText(agents, "# sentinel\n");
    const result = await compile({ cwd: project.cwd, dryRun: true });
    expect(result.wrote).toBe(false);
    expect(readFileSync(agents, "utf8")).toBe("# sentinel\n");
  });
});
