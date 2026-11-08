/**
 * CLI compile Build ID + --clean.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { applyBuildId } from "@b-apm/integration-api";
import { createTempProject, linkIntegration, type TempProject } from "./helpers.ts";
import { runInProject } from "../integrations/map-load-helpers.ts";

function writeCompileProject(cwd: string, ids: string[] = ["cursor"]): void {
  mkdirSync(join(cwd, ".cursor"), { recursive: true });
  mkdirSync(join(cwd, ".apm", "instructions"), { recursive: true });
  for (const id of ids) linkIntegration(cwd, id);
  writeFileSync(
    join(cwd, "bapm.yml"),
    "name: compile-build-id\nversion: 0.0.1\ndependencies:\n  apm: []\n",
    "utf8",
  );
  writeFileSync(
    join(cwd, ".apm", "instructions", "style.md"),
    "# Style\nPrefer concise answers.\n",
    "utf8",
  );
}

function writeInstruction(cwd: string, contents: string): void {
  writeFileSync(join(cwd, ".apm", "instructions", "style.md"), contents, "utf8");
}

function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

function buildId(content: string): string | undefined {
  return /^<!-- Build ID: ([0-9a-f]{12}) -->$/m.exec(content)?.[1];
}

describe("CLI compile build id + clean", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("compiled output carries a stable Build ID that changes with content", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);

    const first = await runInProject(project.cwd, ["compile"]);
    expect(first.result, first.combined).toBe(0);
    const firstBody = readFileSync(join(project.cwd, "AGENTS.md"), "utf8");
    const firstId = buildId(firstBody);
    expect(firstId).toMatch(/^[0-9a-f]{12}$/);

    const second = await runInProject(project.cwd, ["compile"]);
    expect(second.result, second.combined).toBe(0);
    const secondBody = readFileSync(join(project.cwd, "AGENTS.md"), "utf8");
    expect(secondBody).toBe(firstBody);

    writeInstruction(project.cwd, "# Style\nPrefer very concise answers.\n");
    const third = await runInProject(project.cwd, ["compile"]);
    expect(third.result, third.combined).toBe(0);
    const thirdBody = readFileSync(join(project.cwd, "AGENTS.md"), "utf8");
    expect(buildId(thirdBody)).toMatch(/^[0-9a-f]{12}$/);
    expect(buildId(thirdBody)).not.toBe(firstId);
  });

  test("--clean removes stale generated outputs only", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);
    writeText(join(project.cwd, "docs", "AGENTS.md"), applyBuildId("# old\n\nStale.\n"));
    writeText(join(project.cwd, "legacy", "AGENTS.md"), "# manual\n\nHand authored.\n");

    const { result, combined } = await runInProject(project.cwd, ["compile", "--clean"]);

    expect(result, combined).toBe(0);
    expect(combined).toMatch(/compile --clean: removed docs\/AGENTS\.md/);
    expect(existsSync(join(project.cwd, "docs", "AGENTS.md"))).toBe(false);
    expect(existsSync(join(project.cwd, "legacy", "AGENTS.md"))).toBe(true);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(true);
  });

  test("--clean --dry-run lists removals without deleting", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);
    writeText(join(project.cwd, "docs", "AGENTS.md"), applyBuildId("# old\n\nStale.\n"));

    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--clean",
      "--dry-run",
    ]);

    expect(result, combined).toBe(0);
    expect(combined).toMatch(/compile --clean --dry-run: would remove docs\/AGENTS\.md/);
    expect(existsSync(join(project.cwd, "docs", "AGENTS.md"))).toBe(true);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });

  test("--clean --validate never deletes", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);
    writeText(join(project.cwd, "docs", "AGENTS.md"), applyBuildId("# old\n\nStale.\n"));

    const { result } = await runInProject(project.cwd, ["compile", "--clean", "--validate"]);

    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, "docs", "AGENTS.md"))).toBe(true);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });

  test("--clean works with multi-target selection", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd, ["cursor", "claude"]);
    writeText(join(project.cwd, "docs", "AGENTS.md"), applyBuildId("# old\n\nStale.\n"));
    writeText(join(project.cwd, "docs", "CLAUDE.md"), applyBuildId("# old\n\nStale.\n"));

    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--target",
      "cursor,claude",
      "--clean",
    ]);

    expect(result, combined).toBe(0);
    expect(existsSync(join(project.cwd, "docs", "AGENTS.md"))).toBe(false);
    expect(existsSync(join(project.cwd, "docs", "CLAUDE.md"))).toBe(false);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(project.cwd, "CLAUDE.md"))).toBe(true);
  });

  test("--clean with --distributed removes a stale previous placement", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);
    writeInstruction(
      project.cwd,
      '---\ndescription: Style\napplyTo: "src/**"\n---\n\n# Style\nFirst placement.\n',
    );

    const first = await runInProject(project.cwd, [
      "compile",
      "--target",
      "cursor",
      "--distributed",
    ]);
    expect(first.result, first.combined).toBe(0);
    expect(existsSync(join(project.cwd, "src", "AGENTS.md"))).toBe(true);

    writeInstruction(
      project.cwd,
      '---\ndescription: Style\napplyTo: "docs/**"\n---\n\n# Style\nSecond placement.\n',
    );
    const second = await runInProject(project.cwd, [
      "compile",
      "--target",
      "cursor",
      "--distributed",
      "--clean",
    ]);

    expect(second.result, second.combined).toBe(0);
    expect(second.combined).toMatch(/removed src\/AGENTS\.md/);
    expect(existsSync(join(project.cwd, "src", "AGENTS.md"))).toBe(false);
    expect(existsSync(join(project.cwd, "docs", "AGENTS.md"))).toBe(true);
  });
});
