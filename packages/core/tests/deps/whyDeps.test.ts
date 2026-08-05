/**
 * Unit: whyDeps name/repo_url match, exits, transitive chain, offline-only.
 */
import { whyDeps } from "@bapm/core";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";

const TRANSITIVE = `lockfile_version: "1"
dependencies:
  - name: org/parent
    repo_url: https://example.com/org/parent.git
    source: git
    resolved_tag: v1.0.0
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  - name: org/child
    repo_url: https://example.com/org/child.git
    source: git
    resolved_tag: v2.0.0
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    resolved_by:
      - org/parent
`;

describe("whyDeps unit", () => {
  let cwd: string;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
  });

  function project(lock?: string): void {
    cwd = mkdtempSync(join(tmpdir(), "bapm-why-unit-"));
    write(
      join(cwd, "bapm.yml"),
      "name: why-unit\nversion: 0.0.1\ndependencies:\n  apm: []\n",
    );
    if (lock != null) write(join(cwd, "bapm.lock.yaml"), lock);
  }

  test("exact name match", () => {
    project(TRANSITIVE);
    const r = whyDeps({ cwd, package: "org/parent" });
    expect(r.ok).toBe(true);
    expect(r.exitCode).toBe(0);
    expect(r.package?.name).toBe("org/parent");
    expect(r.package?.is_direct).toBe(true);
  });

  test("exact repo_url match", () => {
    project(TRANSITIVE);
    const r = whyDeps({ cwd, package: "https://example.com/org/child.git" });
    expect(r.ok).toBe(true);
    expect(r.exitCode).toBe(0);
    expect(r.package?.name).toBe("org/child");
    expect(r.package?.repo_url).toBe("https://example.com/org/child.git");
  });

  test("missing package → not_installed exit 1", () => {
    project(TRANSITIVE);
    const r = whyDeps({ cwd, package: "missing-pkg" });
    expect(r.ok).toBe(false);
    expect(r.exitCode).toBe(1);
    expect(r.error).toBe("not_installed");
  });

  test("no lock → no_lockfile exit 2", () => {
    project();
    const r = whyDeps({ cwd, package: "anything" });
    expect(r.ok).toBe(false);
    expect(r.exitCode).toBe(2);
    expect(r.error).toBe("no_lockfile");
  });

  test("transitive parent chain in paths", () => {
    project(TRANSITIVE);
    const r = whyDeps({ cwd, package: "org/child" });
    expect(r.ok).toBe(true);
    const paths = r.paths ?? [];
    const ok = paths.some((p) => {
      const ids = p.chain.map((n) => String(n.name ?? n.repo_url ?? ""));
      const pi = ids.findIndex((id) => id.includes("parent"));
      const ci = ids.findIndex((id) => id.includes("child"));
      return pi >= 0 && ci >= 0 && pi < ci;
    });
    expect(ok).toBe(true);
    expect(r.text).toMatch(/parent.*child|→/);
  });

  test("offline-only: no network side effects (lock is sole source)", () => {
    project(TRANSITIVE);
    const before = process.env.http_proxy;
    process.env.http_proxy = "http://127.0.0.1:1";
    try {
      const r = whyDeps({ cwd, package: "org/child" });
      expect(r.ok).toBe(true);
      expect(r.exitCode).toBe(0);
    } finally {
      if (before === undefined) delete process.env.http_proxy;
      else process.env.http_proxy = before;
    }
  });
});

function write(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}
