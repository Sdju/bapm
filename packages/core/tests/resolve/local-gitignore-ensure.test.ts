/**
 * Unit: ensure-untracked helper for bapm `local` roots.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  collectLocalSourcePaths,
  ensureLocalRootUntracked,
  ensureLocalSourcesUntracked,
  parseManifestDocument,
  ResolverError,
} from "@b-apm/core";

type Temp = { cwd: string; cleanup: () => void };

function tempProject(): Temp {
  const cwd = mkdtempSync(join(tmpdir(), "bapm-ensure-"));
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

function initGit(cwd: string): void {
  execFileSync("git", ["init"], { cwd, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "t@example.com"], { cwd, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "t"], { cwd, stdio: "ignore" });
}

describe("ensureLocalRootUntracked", () => {
  const projects: Temp[] = [];
  afterEach(() => {
    projects.splice(0).forEach((p) => p.cleanup());
  });

  test("appends missing ignore for default root", () => {
    const project = tempProject();
    projects.push(project);
    writeFileSync(join(project.cwd, ".gitignore"), "node_modules/\n");
    ensureLocalRootUntracked({
      projectRoot: project.cwd,
      originalPath: ".agents/local",
    });
    const ignore = readFileSync(join(project.cwd, ".gitignore"), "utf8");
    expect(ignore).toContain("node_modules/");
    expect(ignore).toMatch(/\.agents\/local/);
  });

  test("covers custom root pattern", () => {
    const project = tempProject();
    projects.push(project);
    ensureLocalRootUntracked({
      projectRoot: project.cwd,
      originalPath: "./alt-local",
    });
    expect(readFileSync(join(project.cwd, ".gitignore"), "utf8")).toMatch(/alt-local/);
  });

  test("no-git still creates covering ignore", () => {
    const project = tempProject();
    projects.push(project);
    expect(existsSync(join(project.cwd, ".git"))).toBe(false);
    ensureLocalRootUntracked({
      projectRoot: project.cwd,
      originalPath: ".agents/local",
    });
    expect(readFileSync(join(project.cwd, ".gitignore"), "utf8")).toMatch(/\.agents\/local/);
  });

  test("tracked files under root fail closed", () => {
    const project = tempProject();
    projects.push(project);
    initGit(project.cwd);
    const root = join(project.cwd, ".agents", "local");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "apm.yml"), "name: t\nversion: 0.0.1\n");
    writeFileSync(join(project.cwd, ".gitignore"), "node_modules/\n");
    execFileSync("git", ["add", "-A"], { cwd: project.cwd, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "seed"], { cwd: project.cwd, stdio: "ignore" });

    expect(() =>
      ensureLocalRootUntracked({
        projectRoot: project.cwd,
        originalPath: ".agents/local",
      }),
    ).toThrow(ResolverError);

    try {
      ensureLocalRootUntracked({
        projectRoot: project.cwd,
        originalPath: ".agents/local",
      });
    } catch (error) {
      const err = error as ResolverError;
      expect(err.code).toBe("LOCAL_ROOT_TRACKED");
      expect(err.message).toMatch(/git rm --cached|tracked/i);
    }
  });

  test("collectLocalSourcePaths skips plain path:", () => {
    const { document } = parseManifestDocument({
      name: "r",
      version: "0.0.1",
      dependencies: {
        apm: [{ path: "./pkgs/a" }, { local: true }, { local: "./alt" }],
      },
    });
    expect(collectLocalSourcePaths(document)).toEqual([".agents/local", "./alt"]);
  });

  test("collectLocalSourcePaths includes YAML string list item local", () => {
    const { document } = parseManifestDocument({
      name: "r",
      version: "0.0.1",
      dependencies: { apm: ["local"] },
    });
    expect(collectLocalSourcePaths(document)).toEqual([".agents/local"]);
  });

  test("ensureLocalSourcesUntracked no-ops for path-only manifest", () => {
    const project = tempProject();
    projects.push(project);
    writeFileSync(join(project.cwd, ".gitignore"), "node_modules/\n");
    const { document } = parseManifestDocument({
      name: "r",
      version: "0.0.1",
      dependencies: { apm: [{ path: "./pkgs/a" }] },
    });
    ensureLocalSourcesUntracked({ projectRoot: project.cwd, manifest: document });
    expect(readFileSync(join(project.cwd, ".gitignore"), "utf8")).toBe("node_modules/\n");
  });
});
