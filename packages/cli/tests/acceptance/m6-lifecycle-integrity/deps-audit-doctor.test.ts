/**
 * M6 CLI deps / audit / doctor — thin commands + exit codes.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectKnownCommand,
  runInProject,
  sha256Hex,
  writeEmptyDepsProject,
  writeLeafProject,
  writeLock,
  type TempProject,
} from "./helpers.ts";

describe("M6 CLI deps + audit + doctor", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("deps list exits 0 and prints lock packages", async () => {
    project = createTempProject();
    writeEmptyDepsProject(project.cwd, "cli-deps-list");
    writeLock(
      project.cwd,
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/alpha\n    name: alpha\n    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"\n`,
    );

    const { result, combined } = await runInProject(project.cwd, ["deps", "list"]);
    expectKnownCommand(combined, "deps list");
    expect(result).toBe(0);
    expect(combined).toMatch(/alpha/i);
  });

  test("deps tree exits 0 with hierarchical output", async () => {
    project = createTempProject();
    writeEmptyDepsProject(project.cwd, "cli-deps-tree");
    writeLock(
      project.cwd,
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/root-a\n    name: root-a\n    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"\n  - repo_url: github.com/example/child-t\n    name: child-t\n    resolved_commit: "cccccccccccccccccccccccccccccccccccccccc"\n`,
    );

    const { result, combined } = await runInProject(project.cwd, ["deps", "tree"]);
    expectKnownCommand(combined, "deps tree");
    expect(result).toBe(0);
    expect(combined).toMatch(/root-a|child-t/i);
  });

  test("audit --ci clean → exit 0", async () => {
    project = createTempProject();
    writeEmptyDepsProject(project.cwd, "cli-audit-clean");
    const rel = ".agents/skills/hello/SKILL.md";
    const content = "---\nname: hello\n---\n# Hi\n";
    mkdirSync(join(project.cwd, ".agents", "skills", "hello"), { recursive: true });
    writeFileSync(join(project.cwd, rel), content, "utf8");
    writeLock(
      project.cwd,
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n    deployed_file_hashes:\n      "${rel}": "${sha256Hex(content)}"\n`,
    );

    const { result, combined } = await runInProject(project.cwd, ["audit", "--ci"]);
    expectKnownCommand(combined, "audit");
    expect(result).toBe(0);
  });

  test("audit --ci missing lock → non-zero", async () => {
    project = createTempProject();
    writeEmptyDepsProject(project.cwd, "cli-audit-nolock");

    const { result, combined } = await runInProject(project.cwd, ["audit", "--ci"]);
    expectKnownCommand(combined, "audit");
    expect(result).not.toBe(0);
    expect(combined).toMatch(/lock/i);
  });

  test("audit --ci hash mismatch → exit 1", async () => {
    project = createTempProject();
    writeEmptyDepsProject(project.cwd, "cli-audit-tamper");
    const rel = ".agents/skills/hello/SKILL.md";
    mkdirSync(join(project.cwd, ".agents", "skills", "hello"), { recursive: true });
    writeFileSync(join(project.cwd, rel), "TAMPERED\n", "utf8");
    writeLock(
      project.cwd,
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n    deployed_file_hashes:\n      "${rel}": "${sha256Hex("good\n")}"\n`,
    );

    const { result, combined } = await runInProject(project.cwd, ["audit", "--ci"]);
    expectKnownCommand(combined, "audit");
    expect(result).toBe(1);
    expect(combined).toMatch(/hash|mismatch|expected|observed|SKILL/i);
  });

  test("doctor exits 0 when git present and project sane", async () => {
    project = createTempProject();
    writeLeafProject(project.cwd, "cli-doctor-ok");
    writeLock(project.cwd, `lockfile_version: "1"\ndependencies: []\n`);

    const { result, combined } = await runInProject(project.cwd, ["doctor"]);
    expectKnownCommand(combined, "doctor");
    expect(result).toBe(0);
    expect(combined).toMatch(/git/i);
  });
});
