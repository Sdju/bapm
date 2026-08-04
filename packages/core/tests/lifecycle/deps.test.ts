/**
 * Core deps inspect — checklist C §14–16.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import {
  createTempProject,
  exitCodeOf,
  getDepsList,
  getDepsTree,
  getDepsWhyOptional,
  textOf,
  writeLock,
  writeManifest,
  type TempProject,
} from "./helpers.ts";

describe("core deps list / tree / why", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("§14 deps list lists lock packages; exit 0", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: deps-list\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/alpha\n    name: alpha\n    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"\n    resolved_tag: v1.0.0\n  - repo_url: github.com/example/beta\n    name: beta\n    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"\n`,
    );

    const result = await Promise.resolve(getDepsList()({ cwd: project.cwd }));
    expect(exitCodeOf(result)).toBe(0);
    const blob = `${textOf(result)}\n${JSON.stringify(result)}`;
    expect(blob).toMatch(/alpha/i);
    expect(blob).toMatch(/beta/i);
  });

  test("§15 deps tree shows hierarchical directs + children", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: deps-tree\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/root-a\n    name: root-a\n    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"\n    dependencies:\n      - github.com/example/child-t\n  - repo_url: github.com/example/child-t\n    name: child-t\n    resolved_commit: "cccccccccccccccccccccccccccccccccccccccc"\n    resolved_by:\n      - root-a\n`,
    );

    const result = await Promise.resolve(getDepsTree()({ cwd: project.cwd }));
    const blob = `${textOf(result)}\n${JSON.stringify(result)}`;
    expect(blob).toMatch(/root-a/i);
    expect(blob).toMatch(/child-t/i);
    // hierarchical cue: indentation, tree chars, or nested structure
    expect(blob).toMatch(/[│├└]| {2,}child|children|tree/i);
  });

  test("§16 deps why offline chains (SHOULD rs-005)", async () => {
    const why = getDepsWhyOptional();
    if (!why) {
      // Soft defer for deps why (rs-005 SHOULD) — suite stays honest without blocking MUST.
      expect(why).toBeUndefined();
      return;
    }
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: deps-why\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/root-a\n    name: root-a\n    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"\n  - repo_url: github.com/example/trans-t\n    name: trans-t\n    resolved_commit: "tttttttttttttttttttttttttttttttttttttttt"\n    resolved_by:\n      - root-a\n`,
    );
    const result = await Promise.resolve(
      why({ cwd: project.cwd, package: "trans-t", name: "trans-t", packages: ["trans-t"] }),
    );
    const blob = `${textOf(result)}\n${JSON.stringify(result)}`;
    expect(blob).toMatch(/root-a/i);
    expect(blob).toMatch(/trans-t/i);
  });
});
