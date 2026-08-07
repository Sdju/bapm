/**
 * Acceptance (RED): view-local-inspect — offline core local package view.
 * OpenSpec change: cli-view-local-package
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  asRecord,
  createTempProject,
  exitCodeOf,
  getViewPackage,
  identityName,
  identityRepoUrl,
  modulesPathOf,
  pinOf,
  summaryOf,
  textOf,
  writeAmbiguousBasenameLock,
  writeInstalledSharedUtilsTree,
  writeManifest,
  writeViewOkLock,
  type TempProject,
} from "./helpers.ts";

describe("cli-view-local-package core view-local-inspect", () => {
  let project: TempProject;
  const view = getViewPackage();

  afterEach(() => {
    project?.cleanup();
  });

  test("exact name resolves with identity + pin (exit 0)", () => {
    project = createTempProject();
    writeManifest(project.cwd, "view-core-exact");
    writeViewOkLock(project.cwd);

    const result = view({ cwd: project.cwd, package: "acme/shared-utils" });
    expect(exitCodeOf(result)).toBe(0);
    const r = asRecord(result);
    expect(r.ok).toBe(true);
    expect(identityName(result)).toBe("acme/shared-utils");
    expect(identityRepoUrl(result)).toMatch(/acme-org\/shared-utils/);
    const pin = pinOf(result);
    expect(pin).toBeTruthy();
    expect(String(pin)).toMatch(/2\.1\.0|v2\.1\.0/);
    expect(textOf(result)).toMatch(/acme\/shared-utils|shared-utils/i);
    expect(textOf(result)).toMatch(/2\.1\.0|v2\.1\.0/);
  });

  test("unique basename resolves", () => {
    project = createTempProject();
    writeManifest(project.cwd, "view-core-basename");
    writeViewOkLock(project.cwd);

    const result = view({ cwd: project.cwd, package: "shared-utils" });
    expect(exitCodeOf(result)).toBe(0);
    expect(asRecord(result).ok).toBe(true);
    expect(identityName(result)).toBe("acme/shared-utils");
  });

  test("modules path when tree exists; summary from description", () => {
    project = createTempProject();
    writeManifest(project.cwd, "view-core-modules");
    writeViewOkLock(project.cwd);
    const tree = writeInstalledSharedUtilsTree(
      project.cwd,
      "name: acme/shared-utils\nversion: 2.1.0\ndescription: Shared helpers for agents\n",
    );

    const result = view({ cwd: project.cwd, package: "acme/shared-utils" });
    expect(exitCodeOf(result)).toBe(0);
    const modulesPath = modulesPathOf(result);
    expect(modulesPath).toBeTruthy();
    expect(String(modulesPath)).toContain("apm_modules");
    expect(String(modulesPath)).toBe(tree);
    expect(summaryOf(result)).toMatch(/Shared helpers for agents/);
    expect(textOf(result)).toMatch(/Shared helpers for agents/);
    expect(textOf(result)).toMatch(/apm_modules/);
  });

  test("missing summary is honest (no invented marketing text)", () => {
    project = createTempProject();
    writeManifest(project.cwd, "view-core-no-summary");
    writeViewOkLock(project.cwd);
    writeInstalledSharedUtilsTree(
      project.cwd,
      "name: acme/shared-utils\nversion: 2.1.0\n",
    );

    const result = view({ cwd: project.cwd, package: "acme/shared-utils" });
    expect(exitCodeOf(result)).toBe(0);
    const summary = summaryOf(result);
    expect(summary === undefined || summary === null || summary === "").toBe(true);
    // Must not invent a marketing blurb when manifest has none
    expect(textOf(result)).not.toMatch(/best[- ]in[- ]class|revolutionary|lorem ipsum/i);
  });

  test("ambiguous basename → exit 1 + error ambiguous", () => {
    project = createTempProject();
    writeManifest(project.cwd, "view-core-ambiguous");
    writeAmbiguousBasenameLock(project.cwd);

    const result = view({ cwd: project.cwd, package: "shared-utils" });
    expect(exitCodeOf(result)).toBe(1);
    const r = asRecord(result);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("ambiguous");
    expect(textOf(result)).toMatch(/ambiguous/i);
  });

  test("missing package → exit 1 + not_installed", () => {
    project = createTempProject();
    writeManifest(project.cwd, "view-core-missing");
    writeViewOkLock(project.cwd);

    const result = view({ cwd: project.cwd, package: "missing-pkg" });
    expect(exitCodeOf(result)).toBe(1);
    const r = asRecord(result);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("not_installed");
    expect(textOf(result)).toMatch(/not (found|installed)|missing/i);
  });

  test("missing lock → exit 2 + no_lockfile", () => {
    project = createTempProject();
    writeManifest(project.cwd, "view-core-nolock");

    const result = view({ cwd: project.cwd, package: "anything" });
    expect(exitCodeOf(result)).toBe(2);
    const r = asRecord(result);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("no_lockfile");
    expect(textOf(result)).toMatch(/lock/i);
  });
});
