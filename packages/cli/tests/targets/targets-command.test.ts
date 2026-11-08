/**
 * `bapm targets` — read-only registered integration introspection.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  linkFixturePackage,
  runInProject,
  writeMapProject,
  type TempProject,
} from "../integrations/map-load-helpers.ts";
import { linkCursorIntegration, writeText } from "../install/helpers.ts";

type TargetRow = {
  target: string;
  id: string;
  status: string;
  active: boolean;
  detected: boolean;
  registered: boolean;
  deployRoots: string[];
  mcpScope: string | null;
  compile: boolean;
};

type Project = TempProject & { home: string; cleanup: () => void };

function createProject(): Project {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-targets-cli-"));
  const home = mkdtempSync(join(tmpdir(), "bapm-targets-home-"));
  return {
    cwd,
    home,
    cleanup: () => {
      rmSync(cwd, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    },
  };
}

function parseRows(stdout: string[]): TargetRow[] {
  return JSON.parse(stdout.join("\n")) as TargetRow[];
}

describe("CLI targets", () => {
  let project: Project | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("no manifest: stable empty JSON and no writes", async () => {
    project = createProject();
    const { result, stdout, stderr } = await runInProject(project.cwd, ["targets", "--json"], {
      HOME: project.home,
    });
    expect(result).toBe(0);
    expect(stderr.join("\n")).toBe("");
    expect(parseRows(stdout)).toEqual([]);
  });

  test("manifest active marks the registered target active", async () => {
    project = createProject();
    linkCursorIntegration(project.cwd);
    writeText(
      project.cwd,
      "bapm.yml",
      "name: targets-active\nversion: 0.0.1\nactive:\n  target: cursor\ndependencies:\n  apm: []\n",
    );

    const { result, stdout } = await runInProject(project.cwd, ["targets", "--json"], {
      HOME: project.home,
    });
    expect(result).toBe(0);
    const row = parseRows(stdout).find((entry) => entry.id === "cursor");
    expect(row).toMatchObject({
      target: "cursor",
      status: "active",
      active: true,
      registered: true,
      mcpScope: "project",
      compile: true,
    });
    expect(row?.deployRoots.length).toBeGreaterThan(0);
  });

  test("custom object-map integration appears with its deploy roots", async () => {
    project = createProject();
    const spec = linkFixturePackage(project.cwd, "create-integration-pkg");
    writeMapProject(project.cwd, { targets: { "x-acme-editor": spec } });

    const { result, stdout } = await runInProject(project.cwd, ["targets", "--json"], {
      HOME: project.home,
    });
    expect(result).toBe(0);
    const row = parseRows(stdout).find((entry) => entry.id === "x-acme-editor");
    expect(row).toMatchObject({
      id: "x-acme-editor",
      registered: true,
      status: "inactive",
      active: false,
      deployRoots: [".acme/skills"],
      compile: true,
    });
  });

  test("--all adds canonical hosts without a registered integration", async () => {
    project = createProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    const { result, stdout } = await runInProject(project.cwd, ["targets", "--json", "--all"], {
      HOME: project.home,
    });
    expect(result).toBe(0);
    const rows = parseRows(stdout);
    const cursor = rows.find((entry) => entry.id === "cursor");
    expect(cursor).toMatchObject({ registered: false, active: false, deployRoots: [] });
    expect(rows.some((entry) => entry.id === "claude" && entry.registered === false)).toBe(true);
  });

  test("table output includes the introspection columns", async () => {
    project = createProject();
    linkCursorIntegration(project.cwd);
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      "name: targets-table\nversion: 0.0.1\nactive:\n  target: cursor\ndependencies:\n  apm: []\n",
      "utf8",
    );
    const { result, stdout } = await runInProject(project.cwd, ["targets"], { HOME: project.home });
    expect(result).toBe(0);
    const text = stdout.join("\n");
    expect(text).toMatch(/TARGET\s+STATUS\s+SOURCE\s+DEPLOY ROOTS\s+MCP\s+COMPILE/);
    expect(text).toMatch(/\bcursor\b/);
  });
});
