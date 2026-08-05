/**
 * CLI install --dev write target + --only skip sides.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectKnownCommand,
  expectKnownFlags,
  hasModules,
  mcpJsonPath,
  readManifestText,
  runInProject,
  writeLeafProject,
  writeMcpProject,
  type TempProject,
} from "./helpers.ts";

describe("CLI install --dev and --only", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("install pkg --dev writes under devDependencies.apm", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7a-cli-dev", { withCursor: true });
    mkdirSync(join(project.cwd, "extra"), { recursive: true });
    writeFileSync(
      join(project.cwd, "extra", "apm.yml"),
      `name: extra\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "./extra",
      "--dev",
    ]);

    expectKnownCommand(combined, "install");
    expectKnownFlags(combined);
    expect(result).toBe(0);

    const manifest = readManifestText(project.cwd);
    expect(manifest).toMatch(/devDependencies:[\s\S]*apm:[\s\S]*(\.\/extra|path:\s*\.\/extra)/);
    // Must not land only under dependencies.apm solely due to this add.
    const depsBlock = manifest.match(/^dependencies:[\s\S]*?(?=^devDependencies:|^[a-z]|\Z)/m)?.[0] ?? "";
    expect(depsBlock).not.toMatch(/path:\s*\.\/extra|\.\/extra/);
  });

  test("--dev without positional is non-mutating for manifest", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "p7a-cli-dev-noop", { withCursor: true });
    const before = readManifestText(project.cwd);

    const { result, combined } = await runInProject(project.cwd, ["install", "--dev"]);

    expectKnownCommand(combined, "install");
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(readManifestText(project.cwd)).toBe(before);
  });

  test("--only apm leaves mcp.json unchanged", async () => {
    project = createTempProject();
    writeMcpProject(project.cwd, "p7a-cli-only-apm");
    expect(existsSync(mcpJsonPath(project.cwd))).toBe(false);

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--only",
      "apm",
      "--target",
      "cursor",
    ]);

    expectKnownCommand(combined, "install");
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(existsSync(mcpJsonPath(project.cwd))).toBe(false);
  });

  test("--only mcp skips APM modules materialize", async () => {
    project = createTempProject();
    writeMcpProject(project.cwd, "p7a-cli-only-mcp");

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--only",
      "mcp",
      "--target",
      "cursor",
    ]);

    expectKnownCommand(combined, "install");
    expectKnownFlags(combined);
    expect(result).toBe(0);
    expect(hasModules(project.cwd)).toBe(false);
    // MCP configure may still run for only=mcp.
    expect(existsSync(mcpJsonPath(project.cwd))).toBe(true);
  });
});
