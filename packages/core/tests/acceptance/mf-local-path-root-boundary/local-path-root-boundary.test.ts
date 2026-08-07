import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import {
  classifyDependencyRef,
  resolveAndLock,
  resolveDependencyGraph,
  type ResolverError,
} from "@bapm/core";

type TempProject = {
  cwd: string;
  cleanup: () => void;
};

function createTempProject(prefix: string): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

function writeManifest(cwd: string, contents: string): void {
  writeFileSync(join(cwd, "apm.yml"), contents, "utf8");
}

function writePackage(cwd: string, name: string, dependencies = "  apm: []\n"): void {
  mkdirSync(cwd, { recursive: true });
  writeManifest(cwd, `name: ${name}\nversion: 0.0.1\ndependencies:\n${dependencies}`);
}

async function captureRejection(fn: () => Promise<unknown>): Promise<ResolverError> {
  try {
    await fn();
  } catch (error) {
    return error as ResolverError;
  }
  throw new Error("Expected resolution to reject");
}

function expectRootEscape(error: ResolverError, originalPath: string): void {
  expect(error).toMatchObject({
    code: "LOCAL_PATH_ESCAPES_PROJECT_ROOT",
    details: expect.objectContaining({
      originalPath,
    }),
  });
}

describe("acceptance: mf-local-path-root-boundary", () => {
  const projects: TempProject[] = [];

  afterEach(() => {
    projects.splice(0).forEach((project) => project.cleanup());
  });

  test("classifies every explicit local string prefix and object path as local", () => {
    const localStrings = [
      "./package",
      "../package",
      "/project/package",
      "~/package",
      String.raw`.\package`,
      String.raw`..\package`,
      String.raw`~\package`,
    ];

    for (const dependency of localStrings) {
      expect(classifyDependencyRef(dependency)).toMatchObject({
        kind: "local",
        path: dependency,
      });
    }

    expect(classifyDependencyRef({ path: String.raw`..\outside` })).toMatchObject({
      kind: "local",
      path: String.raw`..\outside`,
    });
  });

  test("resolves POSIX-normalized in-root targets and transitive siblings from declaring directories", async () => {
    const project = createTempProject("bapm-root-boundary-");
    projects.push(project);
    writeManifest(
      project.cwd,
      "name: root\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./a/../b\n",
    );
    writePackage(join(project.cwd, "a"), "a");
    writePackage(
      join(project.cwd, "b"),
      "b",
      "  apm:\n    - path: ../sibling\n",
    );
    writePackage(join(project.cwd, "sibling"), "sibling");

    const result = await resolveDependencyGraph({ cwd: project.cwd });
    expect(result.nodes.map((node) => node.name)).toEqual(
      expect.arrayContaining(["b", "sibling"]),
    );
    expect(result.nodes.find((node) => node.name === "sibling")).toMatchObject({
      depth: 2,
    });
  });

  test.each([
    ["direct POSIX escape", (from: string, to: string) => relative(from, to)],
    [
      "direct backslash escape",
      (from: string, to: string) => relative(from, to).replaceAll("/", "\\"),
    ],
  ])("rejects %s before graph expansion", async (_caseName, pathFromRoot) => {
    const project = createTempProject("bapm-root-boundary-");
    const outside = createTempProject("bapm-outside-");
    projects.push(project, outside);
    const escapedPath = pathFromRoot(project.cwd, outside.cwd);
    writePackage(outside.cwd, "outside");
    writeManifest(
      project.cwd,
      `name: root\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ${escapedPath}\n`,
    );

    const error = await captureRejection(() => resolveDependencyGraph({ cwd: project.cwd }));
    expectRootEscape(error, escapedPath);
  });

  test.each([
    ["transitive POSIX escape", (from: string, to: string) => relative(from, to)],
    [
      "transitive backslash escape",
      (from: string, to: string) => relative(from, to).replaceAll("/", "\\"),
    ],
  ])("rejects %s from its declaring package directory", async (_caseName, escapeFromMid) => {
    const project = createTempProject("bapm-root-boundary-");
    const outside = createTempProject("bapm-outside-");
    projects.push(project, outside);
    const mid = join(project.cwd, "mid");
    const escapedPath = escapeFromMid(mid, outside.cwd);
    writePackage(outside.cwd, "outside");
    writePackage(mid, "mid", `  apm:\n    - path: ${escapedPath}\n`);
    writeManifest(
      project.cwd,
      "name: root\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./mid\n",
    );

    const error = await captureRejection(() => resolveDependencyGraph({ cwd: project.cwd }));
    expectRootEscape(error, escapedPath);
  });

  test("rejects an escaped object path before manifest read, policy, materialization, and lock write", async () => {
    const project = createTempProject("bapm-root-boundary-");
    const outside = createTempProject("bapm-outside-");
    projects.push(project, outside);
    const escapedPath = relative(project.cwd, outside.cwd);
    writePackage(outside.cwd, "outside");
    writeManifest(
      project.cwd,
      `name: root\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ${escapedPath}\n`,
    );

    const calls = { download: 0, git: 0, tags: 0 };
    const error = await captureRejection(() =>
      resolveAndLock({
        cwd: project.cwd,
        downloader: {
          async download() {
            calls.download += 1;
          },
        },
        gitRemote: {
          async resolveRef() {
            calls.git += 1;
            return "a".repeat(40);
          },
        },
        tagLister: {
          async listTags() {
            calls.tags += 1;
            return [];
          },
        },
      }),
    );

    expectRootEscape(error, escapedPath);
    expect(calls).toEqual({ download: 0, git: 0, tags: 0 });
    expect(existsSync(join(project.cwd, "apm.lock.yaml"))).toBe(false);
    expect(existsSync(join(project.cwd, "bapm.lock.yaml"))).toBe(false);
  });

  test("rejects an out-of-root manifest sentinel before attempting to load it", async () => {
    const project = createTempProject("bapm-root-boundary-");
    const outside = createTempProject("bapm-outside-");
    projects.push(project, outside);
    const escapedPath = relative(project.cwd, outside.cwd);
    writeFileSync(join(outside.cwd, "apm.yml"), ": intentionally-invalid-sentinel", "utf8");
    writeManifest(
      project.cwd,
      `name: root\nversion: 0.0.1\ndependencies:\n  apm:\n    - ${escapedPath}\n`,
    );

    const error = await captureRejection(() => resolveDependencyGraph({ cwd: project.cwd }));
    expectRootEscape(error, escapedPath);
    expect(error.message).not.toMatch(/failed to load local package manifest/i);
  });
});
