/**
 * Acceptance: command/hook participate in pr-002/pr-003 conflict rules.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { diagnosticsOf } from "../../install/helpers.ts";
import {
  createTempProject,
  cursorCommandPrompt,
  cursorFlatHookJson,
  findByNameType,
  getDiscoverPrimitives,
  getResolvePrimitiveConflicts,
  primitivesOf,
  sourceOf,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("commands-hooks-primitives — conflicts", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("local command overrides same name+type from dependency", () => {
    project = createTempProject();
    writeText(
      join(project.cwd, ".apm", "prompts", "shared.prompt.md"),
      cursorCommandPrompt("shared-local"),
    );
    const dep = join(project.cwd, "apm_modules", "github.com", "example", "other");
    mkdirSync(dep, { recursive: true });
    writeFileSync(
      join(dep, "apm.yml"),
      `name: other\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    writeText(join(dep, ".apm", "prompts", "shared.prompt.md"), cursorCommandPrompt("shared-dep"));

    const raw = primitivesOf(getDiscoverPrimitives()({ cwd: project.cwd }));
    const resolved = getResolvePrimitiveConflicts()({
      primitives: raw,
      cwd: project.cwd,
    });
    const shared = findByNameType(primitivesOf(resolved), "shared", "command");
    expect(shared).toBeTruthy();
    expect(sourceOf(shared!)).toBe("local");
    expect(diagnosticsOf(resolved).length).toBeGreaterThan(0);
  });

  test("first-declared dependency wins among dependency hooks", () => {
    project = createTempProject();
    for (const [name, folder] of [
      ["pkg-a", "a"],
      ["pkg-b", "b"],
    ] as const) {
      const dep = join(project.cwd, "apm_modules", "github.com", "example", folder);
      mkdirSync(dep, { recursive: true });
      writeFileSync(
        join(dep, "apm.yml"),
        `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
        "utf8",
      );
      writeText(join(dep, ".apm", "hooks", "dup.json"), cursorFlatHookJson(`./from-${name}.sh`));
    }

    const raw = primitivesOf(
      getDiscoverPrimitives()({
        cwd: project.cwd,
        declarationOrder: ["pkg-a", "pkg-b"],
      }),
    );
    const resolved = getResolvePrimitiveConflicts()({
      primitives: raw,
      declarationOrder: ["pkg-a", "pkg-b"],
    });
    const winners = primitivesOf(resolved).filter((p) => findByNameType([p], "dup", "hook"));
    expect(winners.length).toBe(1);
    expect(sourceOf(winners[0]!)).toBe("dependency:pkg-a");
  });
});
