/**
 * p6f — core whyDeps structured result, honest exits, name/repo_url match.
 * Spec: deps-inspect.
 */
import { asText } from "../asText.ts";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  asRecord,
  createTempProject,
  exitCodeOf,
  getWhyDeps,
  textOf,
  writeManifest,
  writeTransitiveLock,
  type TempProject,
} from "./helpers.ts";

describe("p6f core whyDeps structured result + exits", () => {
  let project: TempProject;
  const why = getWhyDeps();

  afterEach(() => {
    project?.cleanup();
  });

  test("success returns package + paths with stable fields", () => {
    project = createTempProject();
    writeManifest(project.cwd, "p6f-core-why-ok");
    writeTransitiveLock(project.cwd);

    const result = why({ cwd: project.cwd, package: "org/child", name: "org/child" });
    expect(exitCodeOf(result)).toBe(0);
    const r = asRecord(result);
    expect(r.ok).toBe(true);

    const pkg = r.package as Record<string, unknown> | undefined;
    expect(pkg).toBeTruthy();
    expect(pkg!.name).toBe("org/child");
    expect(pkg!.repo_url).toBe("https://example.com/org/child.git");
    expect(typeof pkg!.version).toBe("string");
    expect(asText(pkg!.version).length).toBeGreaterThan(0);
    expect(pkg!.source).toBeTruthy();
    expect(typeof pkg!.is_direct).toBe("boolean");
    expect(pkg!.is_direct).toBe(false);

    expect(Array.isArray(r.paths)).toBe(true);
    const paths = r.paths as Array<{ chain: Array<Record<string, unknown>> }>;
    expect(paths.length).toBeGreaterThan(0);
    const hasParentThenChild = paths.some((p) => {
      const ids = (p.chain ?? []).map((n) => asText(n.name ?? n.repo_url ?? ""));
      const pi = ids.findIndex((id) => id.includes("parent"));
      const ci = ids.findIndex((id) => id.includes("child"));
      return pi >= 0 && ci >= 0 && pi < ci;
    });
    expect(hasParentThenChild).toBe(true);
  });

  test("not installed → exit 1 + error not_installed", () => {
    project = createTempProject();
    writeManifest(project.cwd, "p6f-core-why-missing");
    writeTransitiveLock(project.cwd);

    const result = why({ cwd: project.cwd, package: "missing-pkg", name: "missing-pkg" });
    expect(exitCodeOf(result)).toBe(1);
    const r = asRecord(result);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("not_installed");
  });

  test("no lockfile → exit 2 + error no_lockfile", () => {
    project = createTempProject();
    writeManifest(project.cwd, "p6f-core-why-nolock");

    const result = why({ cwd: project.cwd, package: "anything", name: "anything" });
    expect(exitCodeOf(result)).toBe(2);
    const r = asRecord(result);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("no_lockfile");
  });

  test("exact repo_url query resolves package", () => {
    project = createTempProject();
    writeManifest(project.cwd, "p6f-core-why-url");
    writeTransitiveLock(project.cwd);

    const result = why({
      cwd: project.cwd,
      package: "https://example.com/org/child.git",
      name: "https://example.com/org/child.git",
    });
    expect(exitCodeOf(result)).toBe(0);
    const r = asRecord(result);
    const pkg = r.package as Record<string, unknown>;
    expect(pkg.name).toBe("org/child");
    expect(pkg.repo_url).toBe("https://example.com/org/child.git");
  });

  test("exact name query resolves package", () => {
    project = createTempProject();
    writeManifest(project.cwd, "p6f-core-why-name");
    writeTransitiveLock(project.cwd);

    const result = why({ cwd: project.cwd, package: "org/parent", name: "org/parent" });
    expect(exitCodeOf(result)).toBe(0);
    const r = asRecord(result);
    const pkg = r.package as Record<string, unknown>;
    expect(pkg.name).toBe("org/parent");
    expect(pkg.is_direct).toBe(true);
  });

  test("human text still present on success", () => {
    project = createTempProject();
    writeManifest(project.cwd, "p6f-core-why-text");
    writeTransitiveLock(project.cwd);

    const result = why({ cwd: project.cwd, package: "org/child", name: "org/child" });
    expect(exitCodeOf(result)).toBe(0);
    const text = textOf(result);
    expect(text).toMatch(/parent/i);
    expect(text).toMatch(/child/i);
  });
});
