/**
 * p7c — core cacheClean dryRun preview (SHOULD).
 * Spec: cache-cli-ux.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  asRecord,
  createTempProject,
  getCacheClean,
  modulesEntryCount,
  populateModules,
  writeManifest,
  type TempProject,
} from "./helpers.ts";

describe("p7c core cacheClean dryRun", () => {
  let project: TempProject;
  const clean = getCacheClean();

  afterEach(() => {
    project?.cleanup();
  });

  test("dryRun leaves entries; does not require yes; cleaned false", () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-core-dry-run");
    populateModules(project.cwd, ["alpha", "beta"]);
    expect(modulesEntryCount(project.cwd)).toBe(2);

    const result = clean({ cwd: project.cwd, dryRun: true });
    const r = asRecord(result);
    expect(r.ok).toBe(true);
    expect(r.cleaned).toBe(false);
    expect(modulesEntryCount(project.cwd)).toBe(2);
    expect(Number(r.removedEntries)).toBeGreaterThanOrEqual(2);
    expect(r.refused).not.toBe(true);
  });

  test("dryRun absent root succeeds with would-remove 0", () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-core-dry-absent");
    expect(modulesEntryCount(project.cwd)).toBe(0);

    const result = clean({ cwd: project.cwd, dryRun: true });
    const r = asRecord(result);
    expect(r.ok).toBe(true);
    expect(r.cleaned).toBe(false);
    expect(Number(r.removedEntries)).toBe(0);
  });

  test("without dryRun and without yes still refuses", () => {
    project = createTempProject();
    writeManifest(project.cwd, "p7c-core-refuse");
    populateModules(project.cwd, ["keep"]);
    expect(modulesEntryCount(project.cwd)).toBe(1);

    const result = clean({ cwd: project.cwd });
    const r = asRecord(result);
    expect(r.ok).toBe(false);
    expect(r.refused).toBe(true);
    expect(modulesEntryCount(project.cwd)).toBe(1);
  });
});
