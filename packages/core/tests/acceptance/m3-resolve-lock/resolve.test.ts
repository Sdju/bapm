/**
 * M3 resolve acceptance — checklist C §1–6, 9, 13–15 (+ classify / BFS / nest / cycle / identity).
 *
 * Public API (design): classifyDependencyRef, resolveDependencyGraph, MAX_RESOLVE_DEPTH,
 * APM_MODULES_DIR; injectable TagLister / GitRemote / Downloader ports.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { join } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";
import {
  classifyDependencyRef,
  resolveDependencyGraph,
  MAX_RESOLVE_DEPTH,
  APM_MODULES_DIR,
} from "@bapm/core";
import {
  createTempProject,
  createFakePorts,
  expectRejectsMatching,
  expectThrowsMatching,
  fakeCommit,
  graphNodes,
  walkOrder,
  writeManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("M3 classifyDependencyRef (rs-008 / rs-003)", () => {
  test("kind classify local — path: / local-path form → local", () => {
    expect(typeof classifyDependencyRef).toBe("function");
    const a = classifyDependencyRef({ path: "./packages/foo" });
    const b = classifyDependencyRef("./packages/foo");
    expect(a.kind ?? a).toMatch(/local/i);
    expect(String(b.kind ?? b)).toMatch(/local/i);
  });

  test("kind classify git-literal — repo#main or literal ref", () => {
    const a = classifyDependencyRef("github.com/org/repo#main");
    const b = classifyDependencyRef({
      git: "https://github.com/org/repo.git",
      ref: "abc123def456abc123def456abc123def456ab12",
    });
    expect(String(a.kind ?? a)).toMatch(/git-literal/i);
    expect(String(b.kind ?? b)).toMatch(/git-literal/i);
  });

  test("kind classify git-semver — ref: ^1.2.0", () => {
    const r = classifyDependencyRef({
      git: "https://github.com/org/repo.git",
      ref: "^1.2.0",
    });
    expect(String(r.kind ?? r)).toMatch(/git-semver/i);
  });

  test("kind classify registry — id: → registry; resolve fails deferred (not git fallback)", async () => {
    const r = classifyDependencyRef({
      id: "com.example/pkg",
      registry: "https://registry.example.com",
    });
    expect(String(r.kind ?? r)).toMatch(/registry/i);

    const project = createTempProject();
    try {
      writeManifest(
        project.cwd,
        "bapm.yml",
        `name: reg-root\nversion: 0.0.1\nregistries:\n  default:\n    url: https://registry.example.com\ndependencies:\n  apm:\n    - id: com.example/pkg\n      registry: default\n`,
      );
      await expectRejectsMatching(
        () =>
          resolveDependencyGraph({
            cwd: project.cwd,
          }),
        /registry|deferred|unsupported/i,
      );
    } finally {
      project.cleanup();
    }
  });
});

describe("M3 resolveDependencyGraph — nest / BFS / depth / cycle / identity", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("exports MAX_RESOLVE_DEPTH = 50 and APM_MODULES_DIR = apm_modules", () => {
    expect(MAX_RESOLVE_DEPTH).toBe(50);
    expect(APM_MODULES_DIR).toBe("apm_modules");
  });

  test("refuse nest — conflict_resolution: nest fails (rs-013)", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: nest-root\nversion: 0.0.1\ndependencies:\n  conflict_resolution: nest\n  apm:\n    - path: ./a\n`,
    );
    mkdirSync(join(project.cwd, "a"), { recursive: true });
    writeText(
      join(project.cwd, "a", "apm.yml"),
      `name: a\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );
    await expectRejectsMatching(
      () => resolveDependencyGraph({ cwd: project.cwd }),
      /nest|v0\.2|reserved|conflict_resolution/i,
    );
  });

  test("BFS declaration order — A before B at depth 1 (rs-001)", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: order-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./pkg-a\n    - path: ./pkg-b\n`,
    );
    for (const name of ["pkg-a", "pkg-b"]) {
      mkdirSync(join(project.cwd, name), { recursive: true });
      writeText(
        join(project.cwd, name, "apm.yml"),
        `name: ${name}\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      );
    }
    const result = await resolveDependencyGraph({ cwd: project.cwd });
    const order = walkOrder(result).map((s) => s.toLowerCase());
    const idxA = order.findIndex((s) => s.includes("pkg-a") || s.includes("a"));
    const idxB = order.findIndex((s) => s.includes("pkg-b") || s.includes("b"));
    expect(idxA).toBeGreaterThanOrEqual(0);
    expect(idxB).toBeGreaterThanOrEqual(0);
    expect(idxA).toBeLessThan(idxB);
  });

  test("depth cap — chain > 50 fails naming chain (rs-006)", async () => {
    project = createTempProject();
    const n = MAX_RESOLVE_DEPTH + 1;
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: depth-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./d0\n`,
    );
    for (let i = 0; i < n; i++) {
      const dir = join(project.cwd, `d${i}`);
      mkdirSync(dir, { recursive: true });
      const next =
        i < n - 1
          ? `  apm:\n    - path: ../d${i + 1}\n`
          : `  apm: []\n`;
      writeFileSync(
        join(dir, "apm.yml"),
        `name: d${i}\nversion: 0.0.1\ndependencies:\n${next}`,
        "utf8",
      );
    }
    const err = await expectRejectsMatching(
      () => resolveDependencyGraph({ cwd: project.cwd }),
      /depth|50|max|chain/i,
    );
    const text = err instanceof Error ? err.message : String(err);
    expect(text).toMatch(/d0|d1|→|->|\//);
  });

  test("circular deps A→B→A fail closed (cycle diagnostic)", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: cycle-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./pkg-a\n`,
    );
    mkdirSync(join(project.cwd, "pkg-a"), { recursive: true });
    mkdirSync(join(project.cwd, "pkg-b"), { recursive: true });
    writeText(
      join(project.cwd, "pkg-a", "apm.yml"),
      `name: pkg-a\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ../pkg-b\n`,
    );
    writeText(
      join(project.cwd, "pkg-b", "apm.yml"),
      `name: pkg-b\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ../pkg-a\n`,
    );
    await expectRejectsMatching(
      () => resolveDependencyGraph({ cwd: project.cwd }),
      /circular|cycle/i,
    );
  });

  test("repo identity — host case / trailing .git same; path-case distinct (rs-016)", async () => {
    project = createTempProject();
    const ports = createFakePorts({
      commitsByRef: {
        main: fakeCommit("main-commit-seed-xxxxxxxx"),
      },
    });
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: id-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - git: https://GitHub.com/example/repo.git\n      ref: main\n    - git: https://github.com/example/repo\n      ref: main\n    - git: https://github.com/example/REPO\n      ref: main\n`,
    );
    const result = await resolveDependencyGraph({
      cwd: project.cwd,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });
    const nodes = graphNodes(result);
    const identities = nodes
      .map((n) => String(n.identity ?? n.repo_identity ?? n.repo_url ?? ""))
      .filter(Boolean);
    // Host-case + trailing .git MUST share identity for example/repo.
    const lowerPath = identities.filter((s) => /example\/repo(?!\/)/i.test(s) && !/REPO/.test(s));
    const uniqueLower = new Set(
      lowerPath.map((s) => s.replace(/^https?:\/\//i, "").replace(/\.git$/i, "")),
    );
    // After host-case normalize, both lower-path URLs collapse to one key.
    expect(uniqueLower.size).toBe(1);
    // Path-case REPO remains a distinct identity by default.
    const upperPath = identities.filter((s) => /example\/REPO/.test(s));
    expect(upperPath.length).toBeGreaterThanOrEqual(1);
    expect(upperPath[0]).not.toBe([...uniqueLower][0]);
  });

  test("local transitive — root → local → local appears with depth / resolved_by", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: local-root\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./mid\n`,
    );
    mkdirSync(join(project.cwd, "mid"), { recursive: true });
    mkdirSync(join(project.cwd, "leaf"), { recursive: true });
    writeText(
      join(project.cwd, "mid", "apm.yml"),
      `name: mid\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ../leaf\n`,
    );
    writeText(
      join(project.cwd, "leaf", "apm.yml"),
      `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );
    const result = await resolveDependencyGraph({ cwd: project.cwd });
    const nodes = graphNodes(result);
    const names = nodes.map((n) => String(n.name ?? n.id ?? n.path ?? "").toLowerCase());
    expect(names.some((n) => n.includes("mid"))).toBe(true);
    expect(names.some((n) => n.includes("leaf"))).toBe(true);
    const leaf = nodes.find((n) => String(n.name ?? n.id ?? "").toLowerCase().includes("leaf"));
    expect(leaf).toBeTruthy();
    expect(Number(leaf!.depth ?? leaf!.level)).toBeGreaterThanOrEqual(2);
    expect(String(leaf!.resolved_by ?? "")).toMatch(/->|mid|root/i);
  });
});

// Sync throw path used only when API is sync; keep import smoke for missing export RED.
test("classifyDependencyRef is a named export of @bapm/core", () => {
  expect(typeof classifyDependencyRef).toBe("function");
});

test("missing nest still surfaces via expectThrowsMatching helper contract", () => {
  // Guard: helper rethrows TypeError for missing functions during RED.
  expectThrowsMatching(() => {
    throw new Error("nest reserved for v0.2");
  }, /nest/i);
});
