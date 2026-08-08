/**
 * Acceptance: deployed command/hook paths enter lock inventory; uninstall orphans them.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createCursorRegistry,
  createTempProject,
  cursorCommandPrompt,
  cursorFlatHookJson,
  getRunInstall,
  getRunUninstall,
  writeApmPackage,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("commands-hooks-primitives — lock inventory & orphan cleanup", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("uninstall removes previously inventoried command and hook deploy paths", async () => {
    project = createTempProject();
    const dep = join(project.cwd, "combo-dep");
    writeApmPackage(dep, "combo-dep", {
      prompts: { "tidy-up": cursorCommandPrompt("tidy-up") },
      hooks: { "on-start": cursorFlatHookJson("./scripts/on-start.sh") },
    });
    writeText(join(dep, "scripts", "on-start.sh"), "#!/bin/sh\necho start\n");
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: inventory\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm:\n    - path: ./combo-dep\n`,
      "utf8",
    );
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });

    const registry = createCursorRegistry();
    await getRunInstall()({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
    });

    const cmdPath = join(project.cwd, ".cursor", "commands", "tidy-up.md");
    const hooksPath = join(project.cwd, ".cursor", "hooks.json");
    expect(existsSync(cmdPath)).toBe(true);
    expect(existsSync(hooksPath)).toBe(true);

    const lockPath = existsSync(join(project.cwd, "bapm.lock.yaml"))
      ? join(project.cwd, "bapm.lock.yaml")
      : join(project.cwd, "apm.lock.yaml");
    const lockBefore = readFileSync(lockPath, "utf8");
    expect(lockBefore).toMatch(/\.cursor\/commands\/tidy-up\.md/);
    expect(lockBefore).toMatch(/\.cursor\/hooks/);

    await getRunUninstall()({
      cwd: project.cwd,
      packages: ["combo-dep"],
      names: ["combo-dep"],
    });

    expect(existsSync(cmdPath)).toBe(false);
    if (existsSync(hooksPath)) {
      const after = readFileSync(hooksPath, "utf8");
      expect(after).not.toMatch(/on-start|on_start|combo-dep/i);
    }
  });
});
