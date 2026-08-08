/**
 * Integration: resolveAndLock wires gitignore ensure for bapm `local`
 * (promoted from acceptance; unit helper coverage lives in local-gitignore-ensure.test.ts).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { loadLockfile, resolveAndLock, type ResolverError } from "@bapm/core";
import { createTempProject, writeManifest, writeText, type TempProject } from "./helpers.ts";

function writePackageAt(cwd: string, relDir: string, name: string): void {
  writeText(
    join(cwd, relDir, "apm.yml"),
    `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
  );
}

function writeRootApm(cwd: string, apmEntriesYaml: string): void {
  writeManifest(
    cwd,
    "apm.yml",
    `name: root\nversion: 0.0.1\ndependencies:\n  apm:\n${apmEntriesYaml}`,
  );
}

function initGitRepo(cwd: string): void {
  execFileSync("git", ["init"], { cwd, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd,
    stdio: "ignore",
  });
  execFileSync("git", ["config", "user.name", "bapm-test"], {
    cwd,
    stdio: "ignore",
  });
}

function gitAddAllAndCommit(cwd: string, message = "init"): void {
  execFileSync("git", ["add", "-A"], { cwd, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", message, "--allow-empty"], {
    cwd,
    stdio: "ignore",
  });
}

function gitignoreOf(cwd: string): string | null {
  const path = join(cwd, ".gitignore");
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function lockExists(cwd: string): boolean {
  return existsSync(join(cwd, "apm.lock.yaml")) || existsSync(join(cwd, "bapm.lock.yaml"));
}

async function captureResolverError(fn: () => Promise<unknown>): Promise<ResolverError> {
  try {
    await fn();
  } catch (error) {
    return error as ResolverError;
  }
  throw new Error("Expected resolution to reject");
}

describe("Resolver local gitignore ensure (resolveAndLock)", () => {
  const projects: TempProject[] = [];

  afterEach(() => {
    projects.splice(0).forEach((p) => p.cleanup());
  });

  test("missing ignore rule is appended for default .agents/local", async () => {
    const project = createTempProject();
    projects.push(project);
    initGitRepo(project.cwd);
    writeRootApm(project.cwd, "    - local: true\n");
    writeText(join(project.cwd, ".gitignore"), "node_modules/\n");
    gitAddAllAndCommit(project.cwd, "seed without local tree");
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
    writeRootApm(project.cwd, "    - local: ./alt-local\n");
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
    writeRootApm(project.cwd, "    - local: true\n");
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
    writeRootApm(project.cwd, "    - local: true\n");
    writeText(join(project.cwd, ".gitignore"), "node_modules/\n");
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
    writeRootApm(project.cwd, "    - path: ./pkgs/a\n");
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
