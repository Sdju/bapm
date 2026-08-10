/**
 * M2 dual-file lock discovery acceptance (checklist C §17–25 + delta spec
 * `lockfile-dual-file-discovery`).
 *
 * Public API under test (design): `discoverLockfilePath`, `loadLockfile`,
 * `loadLockfileOrNull`, `writeLockfile`, `APM_LOCK_FILE`, `BAPM_LOCK_FILE`.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { discoverLockfilePath, loadLockfile, loadLockfileOrNull, writeLockfile } from "@b-apm/core";
import {
  copyFixtureAs,
  createTempProject,
  ensureDir,
  expectThrowsMatching,
  fixturePath,
  lockOf,
  readFixture,
  writeLock,
  type TempProject,
} from "./helpers.ts";

const minimalYaml = readFixture("minimal-v1.yml");

describe("M2 discovery — existence matrix", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("only apm.lock.yaml → discovers apm.lock.yaml", () => {
    project = createTempProject();
    const path = writeLock(project.cwd, "apm.lock.yaml", minimalYaml);
    const found = discoverLockfilePath({ cwd: project.cwd });
    expect(found.path).toBe(path);
    expect(found.filename).toBe("apm.lock.yaml");
  });

  test("only bapm.lock.yaml → discovers bapm.lock.yaml", () => {
    project = createTempProject();
    const path = writeLock(project.cwd, "bapm.lock.yaml", minimalYaml);
    const found = discoverLockfilePath({ cwd: project.cwd });
    expect(found.path).toBe(path);
    expect(found.filename).toBe("bapm.lock.yaml");
  });

  test("both present → hard dual-conflict error naming both paths", () => {
    project = createTempProject();
    writeLock(project.cwd, "apm.lock.yaml", minimalYaml);
    writeLock(project.cwd, "bapm.lock.yaml", minimalYaml);
    const err = expectThrowsMatching(
      () => discoverLockfilePath({ cwd: project.cwd }),
      /apm\.lock\.yaml|bapm\.lock\.yaml|both|conflict/i,
    );
    const text = err instanceof Error ? err.message : String(err);
    expect(text).toMatch(/apm\.lock\.yaml/);
    expect(text).toMatch(/bapm\.lock\.yaml/);
  });

  test("neither present → no-lockfile error for discover", () => {
    project = createTempProject();
    expectThrowsMatching(
      () => discoverLockfilePath({ cwd: project.cwd }),
      /no.?lockfile|not found|missing|neither|LOCKFILE_NOT_FOUND/i,
    );
  });

  test("neither present → loadLockfile not-found; loadLockfileOrNull → null", () => {
    project = createTempProject();
    expectThrowsMatching(
      () => loadLockfile({ cwd: project.cwd }),
      /no.?lockfile|not found|missing|neither|LOCKFILE_NOT_FOUND/i,
    );
    expect(loadLockfileOrNull({ cwd: project.cwd })).toBeNull();
  });
});

describe("M2 discovery — explicit path wins", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("explicit apm.lock.yaml loads even when bapm.lock.yaml exists", () => {
    project = createTempProject();
    const apm = writeLock(project.cwd, "apm.lock.yaml", minimalYaml);
    writeLock(project.cwd, "bapm.lock.yaml", minimalYaml);
    const found = discoverLockfilePath({ cwd: project.cwd, path: apm });
    expect(found.path).toBe(apm);
    expect(found.filename).toBe("apm.lock.yaml");
    const loaded = loadLockfile({ path: apm });
    expect(lockOf(loaded).lockfile_version).toBe("1");
    expect(loaded.sourceFilename ?? found.filename).toBe("apm.lock.yaml");
  });

  test("explicit bapm.lock.yaml loads even when apm.lock.yaml exists", () => {
    project = createTempProject();
    writeLock(project.cwd, "apm.lock.yaml", minimalYaml);
    const bapm = writeLock(project.cwd, "bapm.lock.yaml", minimalYaml);
    const found = discoverLockfilePath({ path: bapm });
    expect(found.path).toBe(bapm);
    expect(found.filename).toBe("bapm.lock.yaml");
  });

  test("explicit path missing → missing-file error", () => {
    project = createTempProject();
    const missing = join(project.cwd, "apm.lock.yaml");
    expectThrowsMatching(
      () => discoverLockfilePath({ path: missing }),
      /not found|missing|ENOENT|no such file/i,
    );
    expectThrowsMatching(
      () => loadLockfile({ path: missing }),
      /not found|missing|ENOENT|no such file/i,
    );
  });
});

describe("M2 discovery — no parent walk-up", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("lockfile only in parent → no-lockfile error", () => {
    project = createTempProject();
    writeLock(project.cwd, "apm.lock.yaml", minimalYaml);
    const child = join(project.cwd, "nested");
    ensureDir(child);
    expectThrowsMatching(
      () => discoverLockfilePath({ cwd: child }),
      /no.?lockfile|not found|missing|neither|LOCKFILE_NOT_FOUND/i,
    );
  });
});

describe("M2 discovery — legacy apm.lock ignored", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("only legacy apm.lock → not-found (out of M2 dual-read)", () => {
    project = createTempProject();
    writeFileSync(
      join(project.cwd, "apm.lock"),
      'lockfile_version: "1"\ndependencies: []\n',
      "utf8",
    );
    expectThrowsMatching(
      () => discoverLockfilePath({ cwd: project.cwd }),
      /no.?lockfile|not found|missing|neither|LOCKFILE_NOT_FOUND/i,
    );
  });
});

describe("M2 discovery — shared schema / filename metadata", () => {
  test("same bytes as apm.lock.yaml or bapm.lock.yaml yield equivalent docs", () => {
    const asApm = createTempProject();
    const asBapm = createTempProject();
    try {
      copyFixtureAs(asApm.cwd, "minimal-v1.yml", "apm.lock.yaml");
      copyFixtureAs(asBapm.cwd, "minimal-v1.yml", "bapm.lock.yaml");
      const fromApm = loadLockfile({ cwd: asApm.cwd });
      const fromBapm = loadLockfile({ cwd: asBapm.cwd });
      expect(lockOf(fromApm).lockfile_version).toBe(lockOf(fromBapm).lockfile_version);
      expect(fromApm.sourceFilename).toBe("apm.lock.yaml");
      expect(fromBapm.sourceFilename).toBe("bapm.lock.yaml");
      expect(fromApm.sourcePath).toMatch(/apm\.lock\.yaml$/);
      expect(fromBapm.sourcePath).toMatch(/bapm\.lock\.yaml$/);
    } finally {
      asApm.cleanup();
      asBapm.cleanup();
    }
  });

  test("lock discovery independent of manifest brand (apm.yml + bapm.lock.yaml)", () => {
    const project = createTempProject();
    try {
      writeLock(project.cwd, "bapm.lock.yaml", minimalYaml);
      writeFileSync(join(project.cwd, "apm.yml"), 'name: demo\nversion: "1.0.0"\n', "utf8");
      const found = discoverLockfilePath({ cwd: project.cwd });
      expect(found.filename).toBe("bapm.lock.yaml");
      const loaded = loadLockfile({ cwd: project.cwd });
      expect(loaded.sourceFilename).toBe("bapm.lock.yaml");
    } finally {
      project.cleanup();
    }
  });
});

describe("M2 discovery — write-back and fresh create", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("write-back apm.lock.yaml leaves sibling bapm.lock.yaml absent", () => {
    project = createTempProject();
    writeLock(project.cwd, "apm.lock.yaml", minimalYaml);
    const loaded = loadLockfile({ cwd: project.cwd });
    writeLockfile(lockOf(loaded), {
      cwd: project.cwd,
      sourceFilename: loaded.sourceFilename,
      sourcePath: loaded.sourcePath,
    });
    expect(existsSync(join(project.cwd, "apm.lock.yaml"))).toBe(true);
    expect(existsSync(join(project.cwd, "bapm.lock.yaml"))).toBe(false);
    const round = readFileSync(join(project.cwd, "apm.lock.yaml"), "utf8");
    expect(round).toMatch(/lockfile_version/);
  });

  test("write-back bapm.lock.yaml leaves sibling apm.lock.yaml absent", () => {
    project = createTempProject();
    writeLock(project.cwd, "bapm.lock.yaml", minimalYaml);
    const loaded = loadLockfile({ cwd: project.cwd });
    writeLockfile(lockOf(loaded), {
      cwd: project.cwd,
      sourceFilename: loaded.sourceFilename,
      sourcePath: loaded.sourcePath,
    });
    expect(existsSync(join(project.cwd, "bapm.lock.yaml"))).toBe(true);
    expect(existsSync(join(project.cwd, "apm.lock.yaml"))).toBe(false);
  });

  test("fresh write without path creates bapm.lock.yaml", () => {
    project = createTempProject();
    const doc = lockOf(loadLockfile({ path: fixturePath("minimal-v1.yml") }));
    writeLockfile(doc, { cwd: project.cwd });
    expect(existsSync(join(project.cwd, "bapm.lock.yaml"))).toBe(true);
    expect(existsSync(join(project.cwd, "apm.lock.yaml"))).toBe(false);
  });

  test("fresh write with explicit path uses that path", () => {
    project = createTempProject();
    const doc = lockOf(loadLockfile({ path: fixturePath("minimal-v1.yml") }));
    const dest = join(project.cwd, "custom.lock.yaml");
    writeLockfile(doc, { path: dest });
    expect(existsSync(dest)).toBe(true);
    expect(existsSync(join(project.cwd, "bapm.lock.yaml"))).toBe(false);
  });
});
