/**
 * Acceptance (RED): classify + resolve bapm `local` like path-local packages.
 * OpenSpec change: local-path-source
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import {
  captureResolverError,
  classifyDependencyRef,
  createTempProject,
  loadLockfile,
  resolveAndLock,
  resolveDependencyGraph,
  writePackageAt,
  writeRootManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";

describe("local-path-source classify", () => {
  test("default local classifies as kind local with path .agents/local", () => {
    expect(classifyDependencyRef({ local: true })).toMatchObject({
      kind: "local",
      path: ".agents/local",
    });
    expect(classifyDependencyRef({ local: null })).toMatchObject({
      kind: "local",
      path: ".agents/local",
    });
    expect(classifyDependencyRef({ local: "" })).toMatchObject({
      kind: "local",
      path: ".agents/local",
    });
  });

  test("custom local classifies as kind local with declared path", () => {
    expect(classifyDependencyRef({ local: "./alt" })).toMatchObject({
      kind: "local",
      path: "./alt",
    });
  });

  test("OpenAPM path classification unchanged", () => {
    expect(classifyDependencyRef({ path: "./pkgs/a" })).toMatchObject({
      kind: "local",
      path: "./pkgs/a",
    });
    expect(classifyDependencyRef("./pkgs/a")).toMatchObject({
      kind: "local",
      path: "./pkgs/a",
    });
  });
});

describe("local-path-source resolve", () => {
  const projects: TempProject[] = [];

  afterEach(() => {
    projects.splice(0).forEach((p) => p.cleanup());
  });

  test("default local package is read from .agents/local", async () => {
    const project = createTempProject();
    projects.push(project);
    writePackageAt(project.cwd, ".agents/local", "local-pkg");
    writeRootManifest(project.cwd, "    - local: true\n");

    const result = await resolveDependencyGraph({ cwd: project.cwd });
    expect(result.nodes.map((n) => n.name)).toEqual(expect.arrayContaining(["local-pkg"]));
    const node = result.nodes.find((n) => n.name === "local-pkg");
    expect(node).toMatchObject({ kind: "local" });
    expect(String(node?.path ?? node?.packageRoot ?? "")).toMatch(/\.agents[/\\]local/);
  });

  test("custom local uses declared path, not .agents/local", async () => {
    const project = createTempProject();
    projects.push(project);
    writePackageAt(project.cwd, "pkgs/x", "pkg-x");
    writeRootManifest(project.cwd, "    - local: ./pkgs/x\n");

    const result = await resolveDependencyGraph({ cwd: project.cwd });
    expect(result.nodes.map((n) => n.name)).toEqual(expect.arrayContaining(["pkg-x"]));
    expect(result.nodes.find((n) => n.name === "pkg-x")).toMatchObject({
      kind: "local",
    });
    expect(existsSync(join(project.cwd, ".agents", "local"))).toBe(false);
  });

  test("custom local path escaping root fails like path:", async () => {
    const project = createTempProject();
    const outside = createTempProject("bapm-local-outside-");
    projects.push(project, outside);
    writePackageAt(outside.cwd, ".", "outside");
    const escapedPath = relative(project.cwd, outside.cwd);
    writeRootManifest(project.cwd, `    - local: ${escapedPath}\n`);

    const error = await captureResolverError(() =>
      resolveDependencyGraph({ cwd: project.cwd }),
    );
    expect(error).toMatchObject({
      code: "LOCAL_PATH_ESCAPES_PROJECT_ROOT",
      details: expect.objectContaining({
        originalPath: escapedPath,
      }),
    });
    expect(existsSync(join(project.cwd, "apm.lock.yaml"))).toBe(false);
    expect(existsSync(join(project.cwd, "bapm.lock.yaml"))).toBe(false);
  });

  test("local expands then resolveAndLock succeeds with local lock identity", async () => {
    const project = createTempProject();
    projects.push(project);
    writePackageAt(project.cwd, "pkgs/a", "pkg-a");
    // Pre-ignore so gitignore gate is satisfied once ensure is implemented.
    writeRootManifest(project.cwd, "    - local: ./pkgs/a\n");
    writeText(join(project.cwd, ".gitignore"), "/pkgs/a/\n");

    await resolveAndLock({ cwd: project.cwd });

    const lock = loadLockfile({ cwd: project.cwd });
    const deps = lock.document.dependencies ?? [];
    const local = deps.find(
      (d) =>
        d.name === "pkg-a" ||
        d.source === "local" ||
        String(d.repo_url ?? "").includes("pkg-a") ||
        String((d as { path?: string }).path ?? "").includes("pkgs/a"),
    );
    expect(local).toBeTruthy();
    expect(local!.source).toBe("local");
  });

  test("path: resolveAndLock remains unchanged (no local key)", async () => {
    const project = createTempProject();
    projects.push(project);
    writePackageAt(project.cwd, "pkgs/a", "pkg-a");
    writeRootManifest(project.cwd, "    - path: ./pkgs/a\n");

    await resolveAndLock({ cwd: project.cwd });

    const lock = loadLockfile({ cwd: project.cwd });
    const deps = lock.document.dependencies ?? [];
    const local = deps.find((d) => d.name === "pkg-a" || d.source === "local");
    expect(local).toBeTruthy();
    expect(local!.source).toBe("local");
  });
});
