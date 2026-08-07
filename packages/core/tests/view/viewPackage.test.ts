/**
 * Unit: viewPackage identity/pin, basename, modules path, summary, exits.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { viewPackage } from "@bapm/core";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import * as core from "@bapm/core";

type Temp = { cwd: string; cleanup: () => void };

function temp(): Temp {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-view-unit-"));
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

function write(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

const LOCK = `lockfile_version: "1"
dependencies:
  - name: acme/shared-utils
    repo_url: https://example.com/acme-org/shared-utils.git
    source: git
    version: "2.1.0"
    resolved_tag: v2.1.0
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
`;

const AMBIGUOUS = `lockfile_version: "1"
dependencies:
  - name: acme/shared-utils
    repo_url: https://example.com/acme-org/shared-utils.git
    source: git
    version: "1.0.0"
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  - name: other/shared-utils
    repo_url: https://example.com/other-org/shared-utils.git
    source: git
    version: "2.0.0"
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
`;

function modulesTree(cwd: string): string {
  const normalize =
    (core as Record<string, unknown>).normalizeRepoIdentity ??
    (core as Record<string, unknown>).toLockRepoUrl;
  const toDir = (core as Record<string, unknown>).identityToCacheDir;
  if (typeof normalize !== "function" || typeof toDir !== "function") {
    throw new TypeError("expected identity helpers");
  }
  const identity = String(
    (normalize as (r: string) => string)("https://example.com/acme-org/shared-utils.git"),
  );
  const dir = String((toDir as (id: string) => string)(identity));
  return join(cwd, "apm_modules", dir, "bbbbbbbbbbbb");
}

describe("viewPackage unit", () => {
  let project: Temp;

  afterEach(() => {
    project?.cleanup();
  });

  test("exact name → identity + pin exit 0", () => {
    project = temp();
    write(join(project.cwd, "bapm.yml"), "name: t\nversion: 0.0.1\ndependencies:\n  apm: []\n");
    write(join(project.cwd, "bapm.lock.yaml"), LOCK);

    const r = viewPackage({ cwd: project.cwd, package: "acme/shared-utils" });
    expect(r.ok).toBe(true);
    expect(r.exitCode).toBe(0);
    expect(r.identity?.name).toBe("acme/shared-utils");
    expect(r.version).toMatch(/2\.1\.0/);
    expect(r.text).toMatch(/acme\/shared-utils/);
  });

  test("unique basename resolves", () => {
    project = temp();
    write(join(project.cwd, "bapm.yml"), "name: t\nversion: 0.0.1\ndependencies:\n  apm: []\n");
    write(join(project.cwd, "bapm.lock.yaml"), LOCK);

    const r = viewPackage({ cwd: project.cwd, package: "shared-utils" });
    expect(r.ok).toBe(true);
    expect(r.identity?.name).toBe("acme/shared-utils");
  });

  test("modules path + summary from description", () => {
    project = temp();
    write(join(project.cwd, "bapm.yml"), "name: t\nversion: 0.0.1\ndependencies:\n  apm: []\n");
    write(join(project.cwd, "bapm.lock.yaml"), LOCK);
    const tree = modulesTree(project.cwd);
    write(
      join(tree, "apm.yml"),
      "name: acme/shared-utils\nversion: 2.1.0\ndescription: Shared helpers for agents\n",
    );

    const r = viewPackage({ cwd: project.cwd, package: "acme/shared-utils" });
    expect(r.modulesPath).toBe(tree);
    expect(r.summary).toMatch(/Shared helpers/);
    expect(r.text).toMatch(/apm_modules/);
  });

  test("missing summary is empty", () => {
    project = temp();
    write(join(project.cwd, "bapm.yml"), "name: t\nversion: 0.0.1\ndependencies:\n  apm: []\n");
    write(join(project.cwd, "bapm.lock.yaml"), LOCK);
    write(join(modulesTree(project.cwd), "apm.yml"), "name: acme/shared-utils\nversion: 2.1.0\n");

    const r = viewPackage({ cwd: project.cwd, package: "acme/shared-utils" });
    expect(r.summary).toBeUndefined();
    expect(r.text).not.toMatch(/best[- ]in[- ]class|revolutionary/i);
  });

  test("ambiguous → exit 1", () => {
    project = temp();
    write(join(project.cwd, "bapm.yml"), "name: t\nversion: 0.0.1\ndependencies:\n  apm: []\n");
    write(join(project.cwd, "bapm.lock.yaml"), AMBIGUOUS);

    const r = viewPackage({ cwd: project.cwd, package: "shared-utils" });
    expect(r.exitCode).toBe(1);
    expect(r.error).toBe("ambiguous");
  });

  test("not_installed → exit 1", () => {
    project = temp();
    write(join(project.cwd, "bapm.yml"), "name: t\nversion: 0.0.1\ndependencies:\n  apm: []\n");
    write(join(project.cwd, "bapm.lock.yaml"), LOCK);

    const r = viewPackage({ cwd: project.cwd, package: "missing-pkg" });
    expect(r.exitCode).toBe(1);
    expect(r.error).toBe("not_installed");
  });

  test("no_lockfile → exit 2", () => {
    project = temp();
    write(join(project.cwd, "bapm.yml"), "name: t\nversion: 0.0.1\ndependencies:\n  apm: []\n");

    const r = viewPackage({ cwd: project.cwd, package: "anything" });
    expect(r.exitCode).toBe(2);
    expect(r.error).toBe("no_lockfile");
  });
});
