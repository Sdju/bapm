/**
 * GitHub #30 — git dependency + virtual `path:` (APM monorepo package form).
 * Uses a real local git repository; no network.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { computeCanonicalTreeSha256, resolveAndLock, resolveDependencyGraph } from "@b-apm/core";
import {
  createTempProject,
  createVirtualGitRepo,
  depsOf,
  expectRejectsMatching,
  graphNodes,
  lockOf,
  writeManifest,
  type TempProject,
} from "./helpers.ts";

describe("git dependency with virtual path", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  function manifestWith(git: string, path: string): string {
    return `name: virtual-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: ${JSON.stringify(git)}\n      path: ${JSON.stringify(path)}\n`;
  }

  test("resolveGraph reads the subdirectory package, not the clone root", async () => {
    project = createTempProject();
    const repo = createVirtualGitRepo(project.cwd);
    writeManifest(project.cwd, "bapm.yml", manifestWith(repo, "./packages//leaf/"));

    const result = await resolveDependencyGraph({ cwd: project.cwd });
    const leaf = graphNodes(result).find((n) => n.name === "leaf");
    expect(leaf).toBeTruthy();
    expect(leaf!.virtualPath).toBe("packages/leaf");
    expect(String(leaf!.packageRoot)).toMatch(/packages[/\\]leaf$/);
    expect(String(leaf!.packageRoot)).not.toMatch(/\.git/);

    const manifest = readFileSync(join(String(leaf!.packageRoot), "apm.yml"), "utf8");
    expect(manifest).toMatch(/^name:\s*leaf/m);
    expect(existsSync(join(String(leaf!.packageRoot), "skills", "leaf", "SKILL.md"))).toBe(true);
    // Root-only package is outside the virtual package root.
    expect(existsSync(join(String(leaf!.packageRoot), "skills", "root-only"))).toBe(false);
  });

  test("child dependencies resolve relative to the virtual package root", async () => {
    project = createTempProject();
    const repo = createVirtualGitRepo(project.cwd, { leafDependency: "child" });
    writeManifest(project.cwd, "bapm.yml", manifestWith(repo, "packages/leaf"));

    const result = await resolveDependencyGraph({ cwd: project.cwd });
    const names = graphNodes(result).map((n) => String(n.name));
    expect(names).toContain("leaf");
    expect(names).toContain("child");
  });

  test("resolveAndLock emits virtual_path and hashes the subdirectory tree", async () => {
    project = createTempProject();
    const repo = createVirtualGitRepo(project.cwd);
    writeManifest(project.cwd, "bapm.yml", manifestWith(repo, "packages/leaf"));

    const result = await resolveAndLock({ cwd: project.cwd });
    const deps = depsOf(lockOf(result));
    const leaf = deps.find((d) => d.name === "leaf");
    expect(leaf).toBeTruthy();
    expect(leaf!.virtual_path).toBe("packages/leaf");
    expect(leaf!.path).toBeUndefined();
    expect(typeof leaf!.tree_sha256).toBe("string");
    expect(leaf!.tree_sha256).toBe(computeCanonicalTreeSha256(join(repo, "packages", "leaf")));
  });

  test("missing virtual path fails closed with repo and path in the diagnostic", async () => {
    project = createTempProject();
    const repo = createVirtualGitRepo(project.cwd);
    writeManifest(project.cwd, "bapm.yml", manifestWith(repo, "packages/missing"));

    const err = await expectRejectsMatching(
      () => resolveDependencyGraph({ cwd: project.cwd }),
      /packages\/missing|virtual path/i,
    );
    const message = err instanceof Error ? err.message : String(err);
    expect(message).toContain("packages/missing");
    expect(message).toMatch(/git repository|remote-repo/i);
  });

  test("escaping or absolute virtual paths are rejected before download", async () => {
    project = createTempProject();
    const repo = createVirtualGitRepo(project.cwd);

    for (const path of ["../outside", "packages/../../outside", "/tmp/outside"]) {
      writeManifest(project.cwd, "bapm.yml", manifestWith(repo, path));
      const err = await expectRejectsMatching(
        () => resolveDependencyGraph({ cwd: project.cwd }),
        /virtual path|escape|relative|absolute/i,
      );
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toContain(path);
    }
  });
});
