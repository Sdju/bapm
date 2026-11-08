/**
 * Unit: whyDeps name/repo_url match, short-form resolve, exits, transitive chain.
 */
import { whyDeps } from "@b-apm/core";
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

const UNIQUE_SHARED = `lockfile_version: "1"
dependencies:
  - name: org/parent
    repo_url: https://example.com/org/parent.git
    source: git
    resolved_tag: v1.0.0
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  - name: acme/shared-utils
    repo_url: https://example.com/acme-org/shared-utils.git
    source: git
    resolved_tag: v2.0.0
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    resolved_by:
      - org/parent
`;

const AMBIGUOUS_BASE = `lockfile_version: "1"
dependencies:
  - name: acme/shared-utils
    repo_url: https://example.com/acme-org/shared-utils.git
    source: git
    resolved_tag: v1.0.0
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  - name: other/shared-utils
    repo_url: https://example.com/other-org/shared-utils.git
    source: git
    resolved_tag: v2.0.0
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
`;

const EXACT_WINS = `lockfile_version: "1"
dependencies:
  - name: shared-utils
    repo_url: https://example.com/named/exact-pkg.git
    source: git
    resolved_tag: v1.0.0
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  - name: other/shared-utils
    repo_url: https://example.com/other-org/shared-utils.git
    source: git
    resolved_tag: v2.0.0
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
`;

describe("whyDeps unit", () => {
  let cwd: string;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
  });

  function project(lock?: string): void {
    cwd = mkdtempSync(join(tmpdir(), "bapm-why-unit-"));
    write(join(cwd, "bapm.yml"), "name: why-unit\nversion: 0.0.1\ndependencies:\n  apm: []\n");
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

  test("unique basename resolves", () => {
    project(UNIQUE_SHARED);
    const r = whyDeps({ cwd, package: "shared-utils" });
    expect(r.ok).toBe(true);
    expect(r.exitCode).toBe(0);
    expect(r.package?.name).toBe("acme/shared-utils");
    expect(r.package?.repo_url).toBe("https://example.com/acme-org/shared-utils.git");
  });

  test("unique owner/repo resolves", () => {
    project(UNIQUE_SHARED);
    const r = whyDeps({ cwd, package: "acme-org/shared-utils" });
    expect(r.ok).toBe(true);
    expect(r.exitCode).toBe(0);
    expect(r.package?.name).toBe("acme/shared-utils");
  });

  test(".git stripped for short-form queries", () => {
    project(UNIQUE_SHARED);
    expect(whyDeps({ cwd, package: "shared-utils" }).ok).toBe(true);
    expect(whyDeps({ cwd, package: "acme-org/shared-utils" }).ok).toBe(true);
  });

  test("ambiguous basename → exit 1 + matches", () => {
    project(AMBIGUOUS_BASE);
    const r = whyDeps({ cwd, package: "shared-utils" });
    expect(r.ok).toBe(false);
    expect(r.exitCode).toBe(1);
    expect(r.error).toBe("ambiguous");
    expect(r.matches?.length).toBeGreaterThanOrEqual(2);
    const urls = (r.matches ?? []).map((m) => String(m.repo_url ?? ""));
    expect(urls.some((u) => u.includes("acme-org/shared-utils"))).toBe(true);
    expect(urls.some((u) => u.includes("other-org/shared-utils"))).toBe(true);
  });

  test("exact name wins over basename collision", () => {
    project(EXACT_WINS);
    const r = whyDeps({ cwd, package: "shared-utils" });
    expect(r.ok).toBe(true);
    expect(r.exitCode).toBe(0);
    expect(r.package?.name).toBe("shared-utils");
    expect(r.package?.repo_url).toBe("https://example.com/named/exact-pkg.git");
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

  test("direct root->name chain with a manifest identity is_direct true (no depth)", () => {
    project(`lockfile_version: "1"
dependencies:
  - name: foo
    repo_url: https://example.com/org/foo.git
    source: git
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    resolved_by: root->foo
  - name: foo-bar
    repo_url: https://example.com/org/foo-bar.git
    source: git
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
`);
    write(
      join(cwd, "bapm.yml"),
      `name: root
version: 0.0.1
dependencies:
  apm:
    - https://example.com/org/foo.git
`,
    );

    const direct = whyDeps({ cwd, package: "foo" });
    expect(direct.ok).toBe(true);
    expect(direct.package?.is_direct).toBe(true);
    expect(direct.paths?.length).toBe(1);
    expect(direct.paths?.[0]?.chain.map((n) => n.name)).toEqual(["foo"]);

    const undeclared = whyDeps({ cwd, package: "foo-bar" });
    expect(undeclared.ok).toBe(true);
    expect(undeclared.package?.is_direct).toBe(false);
    expect(undeclared.paths?.[0]?.chain.map((n) => n.name)).toEqual(["foo-bar"]);
  });

  test("local direct path without resolved_by/depth is_direct true via manifest", () => {
    project(`lockfile_version: "1"
dependencies:
  - name: local-a
    repo_url: local:pkgs/local-a
    source: local
    version: 1.0.0
  - name: local-b
    repo_url: local:pkgs/local-b
    source: local
    version: 1.0.0
`);
    write(
      join(cwd, "bapm.yml"),
      `name: local-root
version: 0.0.1
devDependencies:
  apm:
    - path: ./pkgs/local-a
`,
    );

    const direct = whyDeps({ cwd, package: "local-a" });
    expect(direct.ok).toBe(true);
    expect(direct.package?.is_direct).toBe(true);
    expect(direct.package?.source).toBe("local");

    const undeclared = whyDeps({ cwd, package: "local-b" });
    expect(undeclared.ok).toBe(true);
    expect(undeclared.package?.is_direct).toBe(false);
  });

  test("missing manifest falls back conservatively to lock depth/resolved_by", () => {
    project(`lockfile_version: "1"
dependencies:
  - name: direct-old
    repo_url: https://example.com/org/direct-old.git
    source: git
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  - name: child-old
    repo_url: https://example.com/org/child-old.git
    source: git
    resolved_commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    resolved_by:
      - direct-old
`);
    rmSync(join(cwd, "bapm.yml"), { force: true });

    const direct = whyDeps({ cwd, package: "direct-old" });
    expect(direct.ok).toBe(true);
    expect(direct.package?.is_direct).toBe(true);

    const child = whyDeps({ cwd, package: "child-old" });
    expect(child.ok).toBe(true);
    expect(child.package?.is_direct).toBe(false);
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
