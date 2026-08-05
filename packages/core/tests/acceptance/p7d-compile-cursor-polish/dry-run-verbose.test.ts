/**
 * p7d — core compile dryRun / validate / outputFile / verbose attribution.
 * Spec: compile-agents-md — core options support dry-run and verbose.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  agentsPath,
  attributionOf,
  createTempProject,
  existsSync,
  getCompileAgentsMd,
  join,
  readFileSync,
  writeCompileProject,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("p7d core compile dryRun / verbose options", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("dryRun: true does not write and reports wrote false", () => {
    project = createTempProject();
    writeCompileProject(project.cwd, "p7d-core-dry");
    const compile = getCompileAgentsMd();

    const result = compile({ cwd: project.cwd, dryRun: true, validate: false });
    expect(result.ok).toBe(true);
    expect(result.wrote).toBe(false);
    expect(existsSync(agentsPath(project.cwd))).toBe(false);
    expect(Number(result.primitivesCount)).toBeGreaterThan(0);
  });

  test("dryRun does not rewrite existing output", () => {
    project = createTempProject();
    writeCompileProject(project.cwd, "p7d-core-dry-exist");
    const sentinel = "# sentinel-core-dry-run\n";
    writeText(agentsPath(project.cwd), sentinel);
    const compile = getCompileAgentsMd();

    const result = compile({ cwd: project.cwd, dryRun: true });
    expect(result.wrote).toBe(false);
    expect(readFileSync(agentsPath(project.cwd), "utf8")).toBe(sentinel);
  });

  test("validate: true does not write regardless of dryRun", () => {
    project = createTempProject();
    writeCompileProject(project.cwd, "p7d-core-validate");
    const compile = getCompileAgentsMd();

    const result = compile({ cwd: project.cwd, validate: true, dryRun: true });
    expect(result.ok).toBe(true);
    expect(result.wrote).toBe(false);
    expect(existsSync(agentsPath(project.cwd))).toBe(false);
  });

  test("custom outputFile writes only that path when not dryRun/validate", () => {
    project = createTempProject();
    writeCompileProject(project.cwd, "p7d-core-out");
    const compile = getCompileAgentsMd();
    const outRel = join("nested", "OUT.md");

    const result = compile({ cwd: project.cwd, outputFile: outRel });
    expect(result.ok).toBe(true);
    expect(result.wrote).toBe(true);
    expect(existsSync(join(project.cwd, outRel))).toBe(true);
    expect(existsSync(agentsPath(project.cwd))).toBe(false);
  });

  test("verbose attribution includes name, type, and path", () => {
    project = createTempProject();
    writeCompileProject(project.cwd, "p7d-core-verbose");
    const compile = getCompileAgentsMd();

    const result = compile({ cwd: project.cwd, dryRun: true, verbose: true });
    expect(result.wrote).toBe(false);

    const attribution = attributionOf(result);
    expect(attribution.length).toBeGreaterThan(0);
    const style = attribution.find(
      (entry) =>
        String(entry.name ?? "").toLowerCase() === "style" ||
        String(entry.path ?? "").includes("style.md"),
    );
    expect(style).toBeTruthy();
    expect(String(style!.name)).toMatch(/style/i);
    expect(String(style!.type)).toMatch(/instruction/i);
    expect(String(style!.path ?? "")).toMatch(/style\.md|\.apm[/\\]instructions/);
  });
});
