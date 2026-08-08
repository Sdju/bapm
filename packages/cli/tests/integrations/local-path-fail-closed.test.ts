/**
 * Missing / unresolvable local paths and npm heuristic regressions
 * (promoted from manifest-target-integration-local-path acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createTempProject,
  existsSync,
  linkNamedPackage,
  piMarkerPath,
  plantInRootPiAgent,
  runInProject,
  writeMapProject,
  type TempProject,
} from "./local-path-helpers.ts";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("CLI · local-path map · fail-closed and npm heuristic", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("missing local path fails closed naming id and specifier", async () => {
    project = createTempProject();
    const missing = "./agents/integration/missing";
    writeMapProject(project.cwd, {
      name: "acc-missing-path",
      targets: { "x-pi-agent": missing },
      withLeafSkill: true,
      withCursor: true,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/x-pi-agent/);
    expect(combined).toMatch(/agents\/integration\/missing|\.\/agents\/integration\/missing/);
    expect(combined).toMatch(/resolv|load|module|cannot find|not found|unresolvable|missing/i);
    expect(existsSync(piMarkerPath(project.cwd))).toBe(false);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(false);
  });

  test("bare package name without path prefix remains npm (not a filesystem path)", async () => {
    project = createTempProject();
    // Plant a real local module but bind with a bare name — must NOT load via filesystem.
    plantInRootPiAgent(project.cwd);
    writeMapProject(project.cwd, {
      name: "acc-bare-npm",
      targets: { "x-pi-agent": "pi-agent-local" },
      withLeafSkill: true,
      withCursor: true,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/x-pi-agent/);
    expect(combined).toMatch(/pi-agent-local/);
    expect(combined).toMatch(/resolv|load|module|cannot find|not found|unresolvable/i);
    expect(existsSync(piMarkerPath(project.cwd))).toBe(false);
  });

  test("scoped npm package specifier still loads from project node_modules", async () => {
    project = createTempProject();
    const fixture = join(FIXTURES, "create-integration-pkg");
    const spec = linkNamedPackage(project.cwd, "@acme/integration-editor", fixture);
    writeMapProject(project.cwd, {
      name: "acc-npm-still",
      targets: { "x-acme-editor": spec },
      withLeafSkill: true,
    });

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--target",
      "x-acme-editor",
    ]);

    expect(combined).not.toMatch(/unknown or unregistered target:\s*x-acme-editor/i);
    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, ".acme", "materialized"))).toBe(true);
  });

  test("path: URI scheme is not required for local map success", async () => {
    project = createTempProject();
    plantInRootPiAgent(project.cwd);
    writeMapProject(project.cwd, {
      name: "acc-no-path-uri",
      targets: { "x-pi-agent": "./agents/integration/pi-agent" },
      withLeafSkill: true,
    });

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--target",
      "x-pi-agent",
    ]);

    expect(combined).not.toMatch(/path:\s*\.?\/?agents/i);
    expect(result).toBe(0);
    expect(existsSync(piMarkerPath(project.cwd))).toBe(true);
  });
});
