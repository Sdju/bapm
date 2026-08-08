/**
 * Fail-closed diagnostics for unknown ids and bad map packages
 * (promoted from manifest-target-integration-load acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  acmeMarkerPath,
  createTempProject,
  existsSync,
  join,
  linkFixturePackage,
  runInProject,
  writeMapProject,
  writeText,
  type TempProject,
} from "./map-load-helpers.ts";

const MISSING_PKG = "@acme/does-not-exist-map-load";

describe("CLI · object-map integration load fail-closed", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("forced id missing from registry and map fails with named diagnostic", async () => {
    project = createTempProject();
    const spec = linkFixturePackage(project.cwd, "create-integration-pkg");
    writeMapProject(project.cwd, {
      name: "acc-missing-id",
      targets: { "x-acme-editor": spec },
      withLeafSkill: true,
      withCursor: true,
    });

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--target",
      "x-missing",
    ]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/x-missing/);
    expect(combined).toMatch(/unknown or unregistered target|not (?:a )?registered|unregistered/i);
    expect(existsSync(acmeMarkerPath(project.cwd))).toBe(false);
  });

  test("unresolvable map package fails closed naming id and specifier", async () => {
    project = createTempProject();
    writeMapProject(project.cwd, {
      name: "acc-unresolvable",
      targets: { "x-acme-editor": MISSING_PKG },
      withLeafSkill: true,
      withCursor: true,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/x-acme-editor/);
    expect(combined).toMatch(/@acme\/does-not-exist-map-load/);
    expect(combined).toMatch(/resolv|load|module|cannot find|not found|unresolvable/i);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(false);
  });

  test("marketplace-only map package is rejected as invalid runtime integration", async () => {
    project = createTempProject();
    const spec = linkFixturePackage(project.cwd, "marketplace-only-pkg");
    writeMapProject(project.cwd, {
      name: "acc-marketplace-only",
      targets: { "x-acme-market": spec },
      withLeafSkill: true,
      withCursor: true,
    });

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/x-acme-market/);
    expect(combined).toMatch(new RegExp(spec.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    expect(combined).toMatch(/runtime|marketplace|invalid|not a valid/i);
    expect(existsSync(acmeMarkerPath(project.cwd))).toBe(false);
  });

  test("integration id mismatch against map key fails closed without registering", async () => {
    project = createTempProject();
    const spec = linkFixturePackage(project.cwd, "id-mismatch-pkg");
    writeMapProject(project.cwd, {
      name: "acc-id-mismatch",
      targets: { "x-acme-editor": spec },
      withLeafSkill: true,
    });

    const { result, combined } = await runInProject(project.cwd, [
      "install",
      "--target",
      "x-acme-editor",
    ]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/x-acme-editor/);
    expect(combined).toMatch(new RegExp(spec.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    expect(combined).toMatch(/id|mismatch|does not match|expected/i);
    expect(existsSync(acmeMarkerPath(project.cwd))).toBe(false);
  });

  test("unknown forced id diagnostic hints at install + targets object-map", async () => {
    project = createTempProject();
    writeText(
      project.cwd,
      "bapm.yml",
      "name: acc-missing-hint\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n",
    );
    writeText(
      project.cwd,
      "leaf/apm.yml",
      "name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n",
    );
    writeText(project.cwd, "leaf/.apm/skills/hello/SKILL.md", "---\nname: hello\n---\n# Hello\n");

    const { result, combined } = await runInProject(project.cwd, ["install", "--target", "cursor"]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/cursor/i);
    expect(combined).toMatch(/targets:|object-map|@bapm\/integration|install.*integration/i);
  });
});
