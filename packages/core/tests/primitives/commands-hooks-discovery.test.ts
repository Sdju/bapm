/**
 * Discover command/hook primitives from APM layouts.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { asText } from "../asText.ts";
import {
  createTempProject,
  cursorCommandPrompt,
  cursorFlatHookJson,
  findByNameType,
  getDiscoverPrimitives,
  nameOf,
  primitivesOf,
  sourceOf,
  typeOfPrimitive,
  writeApmPackage,
  writeText,
  type TempProject,
} from "../install/commands-hooks-helpers.ts";

describe("commands/hooks discovery", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("canonical .apm/prompts/*.prompt.md yields command named from stem", () => {
    project = createTempProject();
    writeText(
      join(project.cwd, ".apm", "prompts", "review-pr.prompt.md"),
      cursorCommandPrompt("review-pr"),
    );

    const found = primitivesOf(getDiscoverPrimitives()({ cwd: project.cwd }));
    const cmd = findByNameType(found, "review-pr", "command");
    expect(cmd).toBeTruthy();
    expect(typeOfPrimitive(cmd!)).toMatch(/^command$/i);
    expect(sourceOf(cmd!)).toBe("local");
    expect(asText(cmd!.path)).toMatch(/\.apm[/\\]prompts[/\\]review-pr\.prompt\.md$/);
  });

  test("package-root *.prompt.md is discovered as command (APM backward compat)", () => {
    project = createTempProject();
    writeText(join(project.cwd, "ship-it.prompt.md"), cursorCommandPrompt("ship-it"));

    const found = primitivesOf(getDiscoverPrimitives()({ cwd: project.cwd }));
    const cmd = findByNameType(found, "ship-it", "command");
    expect(cmd).toBeTruthy();
    expect(sourceOf(cmd!)).toBe("local");
  });

  test("typed .apm/hooks/*.json yields hook named from stem", () => {
    project = createTempProject();
    writeText(
      join(project.cwd, ".apm", "hooks", "pre-tool.json"),
      cursorFlatHookJson("./scripts/pre-tool.sh"),
    );

    const found = primitivesOf(getDiscoverPrimitives()({ cwd: project.cwd }));
    const hook = findByNameType(found, "pre-tool", "hook");
    expect(hook).toBeTruthy();
    expect(typeOfPrimitive(hook!)).toMatch(/^hook$/i);
    expect(sourceOf(hook!)).toBe("local");
  });

  test("top-level hooks/*.json is discovered (hook-only package layout)", () => {
    project = createTempProject();
    const dep = join(project.cwd, "apm_modules", "github.com", "example", "hook-only");
    mkdirSync(dep, { recursive: true });
    writeFileSync(
      join(dep, "apm.yml"),
      `name: hook-only\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    writeText(join(dep, "hooks", "post-merge.json"), cursorFlatHookJson("./hooks/run.sh"));

    const found = primitivesOf(getDiscoverPrimitives()({ cwd: project.cwd }));
    const hook = findByNameType(found, "post-merge", "hook");
    expect(hook).toBeTruthy();
    expect(sourceOf(hook!)).toMatch(/^dependency:/);
    expect(nameOf(hook!)).toBe("post-merge");
  });

  test("dependency .apm prompts and hooks are attributed to the package", () => {
    project = createTempProject();
    const dep = join(project.cwd, "apm_modules", "github.com", "example", "cmd-pkg");
    writeApmPackage(dep, "cmd-pkg", {
      prompts: { "lint-pr": cursorCommandPrompt("lint-pr") },
      hooks: { "session-start": cursorFlatHookJson("./notify.sh") },
    });

    const found = primitivesOf(getDiscoverPrimitives()({ cwd: project.cwd }));
    expect(findByNameType(found, "lint-pr", "command")).toBeTruthy();
    expect(sourceOf(findByNameType(found, "lint-pr", "command")!)).toMatch(
      /^dependency:(cmd-pkg|example\/cmd-pkg)/,
    );
    expect(findByNameType(found, "session-start", "hook")).toBeTruthy();
  });
});
