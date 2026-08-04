/**
 * M1 e2e acceptance (checklist C §12–14):
 * - real `.samples/apm/apm.yml` (or vendored CI copy)
 * - same bytes as `bapm.yml` only
 * - both files → dual conflict error
 * - local path deps present; no resolve/install
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { cpSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { discoverManifestPath, loadManifest } from "@bapm/core";
import {
  createTempProject,
  documentOf,
  expectThrowsMatching,
  resolveRealApmYml,
  writeManifest,
  type TempProject,
} from "../helpers.ts";

describe("M1 e2e — real apm.yml", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("loads real apm.yml via discovery as apm.yml with local path deps", () => {
    const real = resolveRealApmYml();
    project = createTempProject();
    cpSync(real.path, join(project.cwd, "apm.yml"));

    const found = discoverManifestPath({ cwd: project.cwd });
    expect(found.filename).toBe("apm.yml");

    const loaded = loadManifest({ cwd: project.cwd });
    expect(loaded.sourceFilename).toBe("apm.yml");
    const doc = documentOf(loaded);
    expect(doc.name).toBe("apm");
    expect(doc.version).toBeTruthy();

    const deps = doc.dependencies as { apm?: unknown[] } | undefined;
    expect(Array.isArray(deps?.apm)).toBe(true);
    expect(deps!.apm!.length).toBeGreaterThanOrEqual(1);

    const serialized = JSON.stringify(deps!.apm);
    expect(serialized).toMatch(/\.\/packages\//);
    expect(serialized).toMatch(/apm-issue-autopilot|batch-bug-shepherd/);
  });

  test("same bytes as bapm.yml only — discovery loads successfully", () => {
    const real = resolveRealApmYml();
    const bytes = readFileSync(real.path, "utf8");
    project = createTempProject();
    writeManifest(project.cwd, "bapm.yml", bytes);

    const found = discoverManifestPath({ cwd: project.cwd });
    expect(found.filename).toBe("bapm.yml");

    const loaded = loadManifest({ cwd: project.cwd });
    expect(loaded.sourceFilename).toBe("bapm.yml");
    expect(documentOf(loaded).name).toBe("apm");
  });

  test("both apm.yml and bapm.yml → hard dual conflict error", () => {
    const real = resolveRealApmYml();
    const bytes = readFileSync(real.path, "utf8");
    project = createTempProject();
    writeManifest(project.cwd, "apm.yml", bytes);
    writeManifest(project.cwd, "bapm.yml", bytes);

    const err = expectThrowsMatching(
      () => loadManifest({ cwd: project!.cwd }),
      /apm\.yml|bapm\.yml|both|conflict/i,
    );
    const text = err instanceof Error ? err.message : String(err);
    expect(text).toMatch(/apm\.yml/);
    expect(text).toMatch(/bapm\.yml/);
  });
});
