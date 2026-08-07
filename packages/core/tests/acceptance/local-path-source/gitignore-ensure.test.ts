/**
 * Acceptance (RED): ensure effective `local` root is gitignored / fail if tracked.
 * OpenSpec change: local-path-source
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  captureResolverError,
  createTempProject,
  gitAddAllAndCommit,
  gitignoreOf,
  initGitRepo,
  loadLockfile,
  resolveAndLock,
  writePackageAt,
  writeRootManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";

function lockExists(cwd: string): boolean {
  return (
    existsSync(join(cwd, "apm.lock.yaml")) || existsSync(join(cwd, "bapm.lock.yaml"))
  );
}

describe("local-path-source gitignore ensure", () => {
  const projects: TempProject[] = [];

  afterEach(() => {
    projects.splice(0).forEach((p) => p.cleanup());
  });

  test("missing ignore rule is appended for default .agents/local", async () => {
    const project = createTempProject();
    projects.push(project);
    initGitRepo(project.cwd);
    writeRootManifest(project.cwd, "    - local: true\n");
    writeText(join(project.cwd, ".gitignore"), "node_modules/\n");
    gitAddAllAndCommit(project.cwd, "seed without local tree");
    // Package appears after seed commit → untracked until ensure ignores it.
    writePackageAt(project.cwd, ".agents/local", "local-pkg");

    await resolveAndLock({ cwd: project.cwd });

    const ignore = gitignoreOf(project.cwd);
    expect(ignore).toBeTruthy();
    expect(ignore!).toMatch(/\.agents\/local/);
    expect(ignore!).toContain("node_modules/");
    expect(lockExists(project.cwd)).toBe(true);
  });

  test("custom local root is also covered by gitignore before success", async () => {
    const project = createTempProject();
    projects.push(project);
    initGitRepo(project.cwd);
    writeRootManifest(project.cwd, "    - local: ./alt-local\n");
    writeText(join(project.cwd, ".gitignore"), "# keep\n");
    gitAddAllAndCommit(project.cwd, "seed");
    writePackageAt(project.cwd, "alt-local", "alt-pkg");

    await resolveAndLock({ cwd: project.cwd });

    const ignore = gitignoreOf(project.cwd);
    expect(ignore).toBeTruthy();
    expect(ignore!).toMatch(/alt-local/);
    expect(lockExists(project.cwd)).toBe(true);
  });

  test("no-git project still appends covering ignore for local root", async () => {
    const project = createTempProject();
    projects.push(project);
    writePackageAt(project.cwd, ".agents/local", "local-pkg");
    writeRootManifest(project.cwd, "    - local: true\n");
    expect(existsSync(join(project.cwd, ".git"))).toBe(false);

    await resolveAndLock({ cwd: project.cwd });

    const ignore = gitignoreOf(project.cwd);
    expect(ignore).toBeTruthy();
    expect(ignore!).toMatch(/\.agents\/local/);
  });

  test("already-tracked local root fails closed with actionable guidance", async () => {
    const project = createTempProject();
    projects.push(project);
    initGitRepo(project.cwd);
    writePackageAt(project.cwd, ".agents/local", "tracked-pkg");
    writeRootManifest(project.cwd, "    - local: true\n");
    writeText(join(project.cwd, ".gitignore"), "node_modules/\n");
    // Force-track files under the local root despite intended convention.
    gitAddAllAndCommit(project.cwd, "track local root by mistake");

    const error = await captureResolverError(() => resolveAndLock({ cwd: project.cwd }));
    const message = `${error.message}\n${JSON.stringify(error)}`;
    expect(message).toMatch(/\.agents\/local|local/i);
    expect(message).toMatch(/git rm --cached|untrack|tracked/i);
    expect(lockExists(project.cwd)).toBe(false);
  });

  test("plain path: does not require local-root gitignore ensure", async () => {
    const project = createTempProject();
    projects.push(project);
    initGitRepo(project.cwd);
    writePackageAt(project.cwd, "pkgs/a", "pkg-a");
    writeRootManifest(project.cwd, "    - path: ./pkgs/a\n");
    writeText(join(project.cwd, ".gitignore"), "node_modules/\n");
    gitAddAllAndCommit(project.cwd, "seed with tracked path package");

    await resolveAndLock({ cwd: project.cwd });

    const ignore = gitignoreOf(project.cwd);
    expect(ignore).toBe("node_modules/\n");
    expect(ignore).not.toMatch(/pkgs\/a/);
    expect(lockExists(project.cwd)).toBe(true);
    const lock = loadLockfile({ cwd: project.cwd });
    expect(lock.document.dependencies?.some((d) => d.name === "pkg-a")).toBe(true);
  });
});
