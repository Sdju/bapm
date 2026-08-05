/**
 * p7c — core whyDeps short-form resolve + P6f regressions.
 * Spec: deps-inspect.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  asRecord,
  createTempProject,
  exitCodeOf,
  getWhyDeps,
  textOf,
  writeAmbiguousBasenameLock,
  writeExactWinsBasenameLock,
  writeManifest,
  writeTransitiveLock,
  writeUniqueSharedUtilsLock,
  type TempProject,
} from "./helpers.ts";

describe("p7c core whyDeps short-form resolve", () => {
  let project: TempProject;
  const why = getWhyDeps();

  afterEach(() => {
    project?.cleanup();
  });

  test("unique basename resolves with package + paths", () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-core-basename");
    writeUniqueSharedUtilsLock(project.cwd);

    const result = why({ cwd: project.cwd, package: "shared-utils" });
    expect(exitCodeOf(result)).toBe(0);
    const r = asRecord(result);
    expect(r.ok).toBe(true);
    const pkg = r.package as Record<string, unknown>;
    expect(pkg.name).toBe("acme/shared-utils");
    expect(pkg.repo_url).toBe("https://example.com/acme-org/shared-utils.git");
    expect(Array.isArray(r.paths)).toBe(true);
    expect((r.paths as unknown[]).length).toBeGreaterThan(0);
  });

  test("unique owner/repo resolves", () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-core-owner-repo");
    writeUniqueSharedUtilsLock(project.cwd);

    const result = why({ cwd: project.cwd, package: "acme-org/shared-utils" });
    expect(exitCodeOf(result)).toBe(0);
    const pkg = asRecord(result).package as Record<string, unknown>;
    expect(pkg.name).toBe("acme/shared-utils");
    expect(pkg.repo_url).toBe("https://example.com/acme-org/shared-utils.git");
  });

  test(".git stripped for short-form queries", () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-core-git-strip");
    writeUniqueSharedUtilsLock(project.cwd);

    const byBase = why({ cwd: project.cwd, package: "shared-utils" });
    expect(exitCodeOf(byBase)).toBe(0);

    const byOwner = why({ cwd: project.cwd, package: "acme-org/shared-utils" });
    expect(exitCodeOf(byOwner)).toBe(0);
    expect((asRecord(byOwner).package as Record<string, unknown>).repo_url).toMatch(/\.git$/);
  });

  test("ambiguous basename → exit 1 + error ambiguous + matches identities", () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-core-ambiguous");
    writeAmbiguousBasenameLock(project.cwd);

    const result = why({ cwd: project.cwd, package: "shared-utils" });
    expect(exitCodeOf(result)).toBe(1);
    const r = asRecord(result);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("ambiguous");
    expect(r.query).toBe("shared-utils");
    expect(Array.isArray(r.matches)).toBe(true);
    const matches = r.matches as Array<Record<string, unknown>>;
    expect(matches.length).toBeGreaterThanOrEqual(2);
    const urls = matches.map((m) => String(m.repo_url ?? "")).filter(Boolean);
    expect(urls.some((u) => u.includes("acme-org/shared-utils"))).toBe(true);
    expect(urls.some((u) => u.includes("other-org/shared-utils"))).toBe(true);
    expect(textOf(result)).toMatch(/ambiguous/i);
  });

  test("exact name wins over basename collision", () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-core-exact-wins");
    writeExactWinsBasenameLock(project.cwd);

    const result = why({ cwd: project.cwd, package: "shared-utils" });
    expect(exitCodeOf(result)).toBe(0);
    const pkg = asRecord(result).package as Record<string, unknown>;
    expect(pkg.name).toBe("shared-utils");
    expect(pkg.repo_url).toBe("https://example.com/named/exact-pkg.git");
  });
});

describe("p7c core whyDeps P6f regressions", () => {
  let project: TempProject;
  const why = getWhyDeps();

  afterEach(() => {
    project?.cleanup();
  });

  test("exact name and repo_url still resolve; exits 0/1/2", () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-core-p6f");
    writeTransitiveLock(project.cwd);

    const byName = why({ cwd: project.cwd, package: "org/parent" });
    expect(exitCodeOf(byName)).toBe(0);
    expect((asRecord(byName).package as Record<string, unknown>).name).toBe("org/parent");

    const byUrl = why({
      cwd: project.cwd,
      package: "https://example.com/org/child.git",
    });
    expect(exitCodeOf(byUrl)).toBe(0);
    expect((asRecord(byUrl).package as Record<string, unknown>).name).toBe("org/child");

    const missing = why({ cwd: project.cwd, package: "missing-pkg" });
    expect(exitCodeOf(missing)).toBe(1);
    expect(asRecord(missing).error).toBe("not_installed");

    project.cleanup();
    project = createTempProject();
    writeManifest(project.cwd, "p7c-core-nolock");
    const nolock = why({ cwd: project.cwd, package: "x" });
    expect(exitCodeOf(nolock)).toBe(2);
    expect(asRecord(nolock).error).toBe("no_lockfile");
  });
});
