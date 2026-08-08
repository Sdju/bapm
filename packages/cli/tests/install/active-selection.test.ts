/**
 * CLI install uses manifest `active` (multi, override, fail-closed).
 * Promoted from manifest-active-targets acceptance.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync } from "node:fs";
import {
  acmeMarkerPath,
  createTempProject,
  existsSync,
  join,
  linkCursorIntegration,
  linkFixturePackage,
  readFileSync,
  runInProject,
  writeActiveProject,
  writeText,
  type TempProject,
} from "./active-helpers.ts";

describe("CLI install · manifest active selection", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("install without --target uses sole active cursor (no detect signal)", async () => {
    project = createTempProject();
    writeActiveProject(project.cwd, {
      name: "cli-sole-active",
      active: ["cursor"],
      withLeafSkill: true,
    });

    const { result, combined } = await runInProject(project.cwd, ["install"]);

    expect(combined).not.toMatch(/Target detection is missing or ambiguous/i);
    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(true);
  });

  test("install multi active materializes cursor + map-bound x-acme-editor", async () => {
    project = createTempProject();
    const cursorSpec = linkCursorIntegration(project.cwd);
    const acmeSpec = linkFixturePackage(project.cwd, "create-integration-pkg");
    writeActiveProject(project.cwd, {
      name: "cli-multi-active",
      active: ["cursor", "x-acme-editor"],
      // Both ids declared so intersection does not empty-filter either host.
      targets: { cursor: cursorSpec, "x-acme-editor": acmeSpec },
      withLeafSkill: true,
    });

    const { result, combined } = await runInProject(project.cwd, ["install"]);

    expect(combined).not.toMatch(/unknown or unregistered target:\s*(cursor|x-acme-editor)/i);
    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(true);
    expect(existsSync(acmeMarkerPath(project.cwd))).toBe(true);
    expect(readFileSync(acmeMarkerPath(project.cwd), "utf8")).toContain("x-acme-editor");
  });

  test("--target overrides multi active and materializes only forced id", async () => {
    project = createTempProject();
    const cursorSpec = linkCursorIntegration(project.cwd);
    const acmeSpec = linkFixturePackage(project.cwd, "create-integration-pkg");
    writeActiveProject(project.cwd, {
      name: "cli-force-over-active",
      active: ["cursor", "x-acme-editor"],
      targets: { cursor: cursorSpec, "x-acme-editor": acmeSpec },
      withLeafSkill: true,
    });

    const { result } = await runInProject(project.cwd, ["install", "--target", "cursor"]);

    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(true);
    expect(existsSync(acmeMarkerPath(project.cwd))).toBe(false);
  });

  test("empty active: [] fails closed (not silent skip / detect path alone)", async () => {
    project = createTempProject();
    writeText(
      project.cwd,
      "bapm.yml",
      [
        "name: cli-empty-active",
        "version: 0.0.1",
        "active: []",
        "dependencies:",
        "  apm:",
        "    - path: ./leaf",
        "",
      ].join("\n"),
    );
    // Detect would succeed — empty `active` must still fail closed at parse/selection.
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeText(
      project.cwd,
      "leaf/apm.yml",
      "name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n",
    );
    writeText(project.cwd, "leaf/.apm/skills/hello/SKILL.md", "---\nname: hello\n---\n# Hello\n");

    const { result, combined } = await runInProject(project.cwd, ["install"]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/active/i);
    expect(combined).toMatch(/empty|non-empty|at least one|\[]/i);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(false);
  });

  test("unknown active id fails without partial materialize", async () => {
    project = createTempProject();
    writeActiveProject(project.cwd, {
      name: "cli-unknown-active",
      active: ["cursor", "x-missing"],
      withLeafSkill: true,
      // Detect alone would activate cursor — unknown `active` peer must abort all.
      withCursor: true,
    });

    const { result, combined } = await runInProject(project.cwd, ["install"]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/x-missing/);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(false);
  });

  test("dual-read apm.yml active selects without --target", async () => {
    project = createTempProject();
    writeActiveProject(project.cwd, {
      name: "cli-apm-active",
      active: ["cursor"],
      filename: "apm.yml",
      withLeafSkill: true,
    });

    const { result } = await runInProject(project.cwd, ["install"]);

    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, ".agents", "skills", "hello", "SKILL.md"))).toBe(true);
  });
});
