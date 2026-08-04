/**
 * M1 dual-file discovery acceptance (checklist C §11 + delta spec
 * `manifest-dual-file-discovery`).
 *
 * Public API under test (design): `discoverManifestPath`, `loadManifest`,
 * `APM_MANIFEST_FILE`, `BAPM_MANIFEST_FILE`.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { discoverManifestPath, loadManifest } from "@bapm/core";
import {
  copyFixtureAs,
  createTempProject,
  documentOf,
  ensureDir,
  expectThrowsMatching,
  fixturePath,
  writeManifest,
  type TempProject,
} from "./helpers.ts";

const minimalYaml = readFileSync(fixturePath("valid-minimal.yml"), "utf8");

describe("M1 discovery — existence matrix", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("only apm.yml → discovers apm.yml", () => {
    project = createTempProject();
    const path = writeManifest(project.cwd, "apm.yml", minimalYaml);
    const found = discoverManifestPath({ cwd: project.cwd });
    expect(found.path).toBe(path);
    expect(found.filename).toBe("apm.yml");
  });

  test("only bapm.yml → discovers bapm.yml", () => {
    project = createTempProject();
    const path = writeManifest(project.cwd, "bapm.yml", minimalYaml);
    const found = discoverManifestPath({ cwd: project.cwd });
    expect(found.path).toBe(path);
    expect(found.filename).toBe("bapm.yml");
  });

  test("both present → hard error naming both paths", () => {
    project = createTempProject();
    writeManifest(project.cwd, "apm.yml", minimalYaml);
    writeManifest(project.cwd, "bapm.yml", minimalYaml);
    const err = expectThrowsMatching(
      () => discoverManifestPath({ cwd: project.cwd }),
      /apm\.yml|bapm\.yml|both|conflict/i,
    );
    const text = err instanceof Error ? err.message : String(err);
    expect(text).toMatch(/apm\.yml/);
    expect(text).toMatch(/bapm\.yml/);
  });

  test("neither present → no-manifest error", () => {
    project = createTempProject();
    expectThrowsMatching(
      () => discoverManifestPath({ cwd: project.cwd }),
      /no.?manifest|not found|missing|neither/i,
    );
  });
});

describe("M1 discovery — explicit path wins", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("explicit apm.yml loads even when bapm.yml exists", () => {
    project = createTempProject();
    const apm = writeManifest(project.cwd, "apm.yml", minimalYaml);
    writeManifest(project.cwd, "bapm.yml", minimalYaml);
    const found = discoverManifestPath({ cwd: project.cwd, path: apm });
    expect(found.path).toBe(apm);
    expect(found.filename).toBe("apm.yml");
    const loaded = loadManifest({ path: apm });
    expect(documentOf(loaded).name).toBe("my-project");
    expect(loaded.sourceFilename ?? found.filename).toBe("apm.yml");
  });

  test("explicit bapm.yml loads even when apm.yml exists", () => {
    project = createTempProject();
    writeManifest(project.cwd, "apm.yml", minimalYaml);
    const bapm = writeManifest(project.cwd, "bapm.yml", minimalYaml);
    const found = discoverManifestPath({ path: bapm });
    expect(found.path).toBe(bapm);
    expect(found.filename).toBe("bapm.yml");
  });

  test("explicit path missing → missing-file error", () => {
    project = createTempProject();
    const missing = join(project.cwd, "apm.yml");
    expectThrowsMatching(
      () => discoverManifestPath({ path: missing }),
      /not found|missing|ENOENT|no such file/i,
    );
  });
});

describe("M1 discovery — no parent walk-up", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("manifest only in parent → no-manifest error", () => {
    project = createTempProject();
    writeManifest(project.cwd, "apm.yml", minimalYaml);
    const child = join(project.cwd, "nested");
    ensureDir(child);
    expectThrowsMatching(
      () => discoverManifestPath({ cwd: child }),
      /no.?manifest|not found|missing|neither/i,
    );
  });
});

describe("M1 discovery — shared schema / filename metadata", () => {
  test("same bytes as apm.yml or bapm.yml yield equivalent documents + sourceFilename", () => {
    const asApm = createTempProject();
    const asBapm = createTempProject();
    try {
      copyFixtureAs(asApm.cwd, "valid-minimal.yml", "apm.yml");
      copyFixtureAs(asBapm.cwd, "valid-minimal.yml", "bapm.yml");
      const fromApm = loadManifest({ cwd: asApm.cwd });
      const fromBapm = loadManifest({ cwd: asBapm.cwd });
      expect(documentOf(fromApm).name).toBe(documentOf(fromBapm).name);
      expect(documentOf(fromApm).version).toBe(documentOf(fromBapm).version);
      expect(fromApm.sourceFilename).toBe("apm.yml");
      expect(fromBapm.sourceFilename).toBe("bapm.yml");
      expect(fromApm.sourcePath).toMatch(/apm\.yml$/);
      expect(fromBapm.sourcePath).toMatch(/bapm\.yml$/);
    } finally {
      asApm.cleanup();
      asBapm.cleanup();
    }
  });
});
