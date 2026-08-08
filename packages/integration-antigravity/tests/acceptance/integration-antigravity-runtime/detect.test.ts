/**
 * Explicit-only detect: always false; shared .agents/ is not a signal.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, loadAntigravityIntegration } from "./helpers.ts";

describe("antigravity detect (explicit-only)", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("shared .agents/ directory does not auto-detect", async () => {
    const project = createTempProject("bapm-agy-detect-agents-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".agents", "skills"), { recursive: true });

    const target = loadAntigravityIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
  });

  test("empty project does not auto-detect and does not create .agents/", async () => {
    const project = createTempProject("bapm-agy-detect-none-");
    cleanup = project.cleanup;

    const target = loadAntigravityIntegration();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
    expect(existsSync(join(project.cwd, ".agents"))).toBe(false);
  });

  test("factory id is antigravity with .agents deploy root", () => {
    const target = loadAntigravityIntegration();
    expect(target.id).toBe("antigravity");
    expect(target.deployRoots.some((r) => r === ".agents" || r.startsWith(".agents"))).toBe(true);
    expect(target.deployRoots.some((r) => r === "." || r === "./")).toBe(true);
  });
});
