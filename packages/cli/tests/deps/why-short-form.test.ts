/**
 * p7c — CLI deps why short-form (basename / owner/repo) + P6f regressions.
 * Specs: deps-inspect, cli-runtime-surface.
 */
import { asText } from "../asText.ts";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  expectKnownFlag,
  parseJsonStderr,
  parseJsonStdout,
  runInProject,
  stdoutText,
  writeAmbiguousBasenameLock,
  writeEmptyLock,
  writeExactWinsBasenameLock,
  writeManifest,
  writeTransitiveLock,
  writeUniqueSharedUtilsLock,
  type TempProject,
} from "./helpers.ts";

describe("p7c CLI deps why short-form resolve", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("unique basename resolves (human + --json)", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-why-basename");
    writeUniqueSharedUtilsLock(project.cwd);

    const human = await runInProject(project.cwd, ["deps", "why", "shared-utils"]);
    expectKnownCommand(human.combined, "deps");
    expect(human.result).toBe(0);
    expect(stdoutText(human.stdout)).toMatch(/shared-utils|acme/i);

    const json = await runInProject(project.cwd, ["deps", "why", "shared-utils", "--json"]);
    expectKnownFlag(json.combined, "--json");
    expect(json.result).toBe(0);
    const doc = parseJsonStdout(json.stdout);
    expect(doc).toHaveProperty("package");
    expect(doc).toHaveProperty("paths");
    const pkg = doc.package as Record<string, unknown>;
    expect(pkg.name).toBe("acme/shared-utils");
    expect(pkg.repo_url).toBe("https://example.com/acme-org/shared-utils.git");
    expect(Array.isArray(doc.paths)).toBe(true);
    expect((doc.paths as unknown[]).length).toBeGreaterThan(0);
  });

  test("unique owner/repo resolves (human + --json)", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-why-owner-repo");
    writeUniqueSharedUtilsLock(project.cwd);

    const human = await runInProject(project.cwd, ["deps", "why", "acme-org/shared-utils"]);
    expectKnownCommand(human.combined, "deps");
    expect(human.result).toBe(0);
    expect(stdoutText(human.stdout)).toMatch(/shared-utils|acme/i);

    const json = await runInProject(project.cwd, [
      "deps",
      "why",
      "acme-org/shared-utils",
      "--json",
    ]);
    expectKnownFlag(json.combined, "--json");
    expect(json.result).toBe(0);
    const doc = parseJsonStdout(json.stdout);
    const pkg = doc.package as Record<string, unknown>;
    expect(pkg.name).toBe("acme/shared-utils");
    expect(pkg.repo_url).toBe("https://example.com/acme-org/shared-utils.git");
  });

  test("trailing .git stripped for basename and owner/repo queries", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-why-git-strip");
    writeUniqueSharedUtilsLock(project.cwd);

    // Lock URL ends with .git; short queries omit .git.
    const byBase = await runInProject(project.cwd, ["deps", "why", "shared-utils", "--json"]);
    expect(byBase.result).toBe(0);
    expect((parseJsonStdout(byBase.stdout).package as Record<string, unknown>).repo_url).toBe(
      "https://example.com/acme-org/shared-utils.git",
    );

    const byOwner = await runInProject(project.cwd, [
      "deps",
      "why",
      "acme-org/shared-utils",
      "--json",
    ]);
    expect(byOwner.result).toBe(0);
    expect((parseJsonStdout(byOwner.stdout).package as Record<string, unknown>).name).toBe(
      "acme/shared-utils",
    );
  });

  test("ambiguous basename → exit 1; --json stderr error ambiguous + matches", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-why-ambiguous");
    writeAmbiguousBasenameLock(project.cwd);

    const human = await runInProject(project.cwd, ["deps", "why", "shared-utils"]);
    expectKnownCommand(human.combined, "deps");
    expect(human.result).toBe(1);
    expect(human.combined).toMatch(/ambiguous/i);

    const json = await runInProject(project.cwd, ["deps", "why", "shared-utils", "--json"]);
    expectKnownFlag(json.combined, "--json");
    expect(json.result).toBe(1);
    const err = parseJsonStderr(json.stderr);
    expect(err.error).toBe("ambiguous");
    expect(err.query).toBe("shared-utils");
    expect(Array.isArray(err.matches)).toBe(true);
    const matches = err.matches as Array<Record<string, unknown>>;
    expect(matches.length).toBeGreaterThanOrEqual(2);
    const urls = matches.map((m) => asText(m.repo_url ?? "")).filter(Boolean);
    expect(urls.some((u) => u.includes("acme-org/shared-utils"))).toBe(true);
    expect(urls.some((u) => u.includes("other-org/shared-utils"))).toBe(true);
  });

  test("exact name wins over basename collision (precedence)", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-why-exact-wins");
    writeExactWinsBasenameLock(project.cwd);

    const json = await runInProject(project.cwd, ["deps", "why", "shared-utils", "--json"]);
    expectKnownCommand(json.combined, "deps");
    expectKnownFlag(json.combined, "--json");
    expect(json.result).toBe(0);
    const pkg = parseJsonStdout(json.stdout).package as Record<string, unknown>;
    expect(pkg.name).toBe("shared-utils");
    expect(pkg.repo_url).toBe("https://example.com/named/exact-pkg.git");
  });
});

describe("p7c CLI deps why P6f regressions", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("exact name and exact repo_url still resolve; --json package+paths", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-p6f-exact");
    writeTransitiveLock(project.cwd);

    const byName = await runInProject(project.cwd, ["deps", "why", "org/parent"]);
    expectKnownCommand(byName.combined, "deps");
    expect(byName.result).toBe(0);
    expect(stdoutText(byName.stdout)).toMatch(/org\/parent/i);

    const byUrl = await runInProject(project.cwd, [
      "deps",
      "why",
      "https://example.com/org/child.git",
      "--json",
    ]);
    expectKnownFlag(byUrl.combined, "--json");
    expect(byUrl.result).toBe(0);
    const doc = parseJsonStdout(byUrl.stdout);
    const pkg = doc.package as Record<string, unknown>;
    expect(pkg.name).toBe("org/child");
    expect(pkg.repo_url).toBe("https://example.com/org/child.git");
    expect(doc).toHaveProperty("paths");
  });

  test("exits 0/1/2: success, not_installed, no_lockfile", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-p6f-exits");
    writeTransitiveLock(project.cwd);

    const ok = await runInProject(project.cwd, ["deps", "why", "org/child"]);
    expect(ok.result).toBe(0);

    const missing = await runInProject(project.cwd, ["deps", "why", "missing-pkg", "--json"]);
    expect(missing.result).toBe(1);
    expect(parseJsonStderr(missing.stderr).error).toBe("not_installed");

    project.cleanup();
    project = createTempProject();
    writeManifest(project.cwd, "p7c-p6f-nolock");
    const nolock = await runInProject(project.cwd, ["deps", "why", "x", "--json"]);
    expect(nolock.result).toBe(2);
    expect(parseJsonStderr(nolock.stderr).error).toBe("no_lockfile");
  });

  test("empty lock missing package still exit 1", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-p6f-empty");
    writeEmptyLock(project.cwd);

    const { result, combined } = await runInProject(project.cwd, ["deps", "why", "nope"]);
    expectKnownCommand(combined, "deps");
    expect(result).toBe(1);
  });
});
