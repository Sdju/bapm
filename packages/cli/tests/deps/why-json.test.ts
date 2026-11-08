/**
 * p6f — CLI `deps why --json`, honest exits, name/repo_url match, human path.
 * Specs: deps-inspect, cli-runtime-surface.
 */
import { join } from "node:path";
import { asText } from "../asText.ts";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  expectKnownFlag,
  parseJsonStderr,
  parseJsonStdout,
  runInProject,
  stdoutText,
  writeEmptyLock,
  writeLock,
  writeManifest,
  writeText,
  writeTransitiveLock,
  type TempProject,
} from "./helpers.ts";

describe("p6f CLI deps why --json + exits", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("why --json success: stdout package+paths, exit 0", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p6f-why-json-ok");
    writeTransitiveLock(project.cwd);

    const { result, stdout, stderr, combined } = await runInProject(project.cwd, [
      "deps",
      "why",
      "org/child",
      "--json",
    ]);
    expectKnownCommand(combined, "deps");
    expectKnownFlag(combined, "--json");
    expect(result).toBe(0);

    const doc = parseJsonStdout(stdout);
    expect(doc).toHaveProperty("package");
    expect(doc).toHaveProperty("paths");
    const pkg = doc.package as Record<string, unknown>;
    expect(pkg.name).toBe("org/child");
    expect(pkg.repo_url).toBe("https://example.com/org/child.git");
    expect(typeof pkg.version).toBe("string");
    expect(asText(pkg.version).length).toBeGreaterThan(0);
    expect(pkg.source).toBeTruthy();
    expect(typeof pkg.is_direct).toBe("boolean");
    expect(Array.isArray(doc.paths)).toBe(true);
    expect((doc.paths as unknown[]).length).toBeGreaterThan(0);

    // Success JSON must not land on stderr.
    expect(stderrTextSafe(stderr)).not.toMatch(/"package"\s*:/);
  });

  test("why --json transitive chain includes parent before child", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p6f-why-json-chain");
    writeTransitiveLock(project.cwd);

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "deps",
      "why",
      "org/child",
      "--json",
    ]);
    expectKnownCommand(combined, "deps");
    expectKnownFlag(combined, "--json");
    expect(result).toBe(0);

    const doc = parseJsonStdout(stdout);
    const paths = doc.paths as Array<{ chain: Array<Record<string, unknown>> }>;
    expect(Array.isArray(paths)).toBe(true);
    const hasParentThenChild = paths.some((p) => {
      const ids = (p.chain ?? []).map((n) => asText(n.name ?? n.repo_url ?? ""));
      const pi = ids.findIndex((id) => id.includes("parent"));
      const ci = ids.findIndex((id) => id.includes("child"));
      return pi >= 0 && ci >= 0 && pi < ci;
    });
    expect(hasParentThenChild).toBe(true);
  });

  test("missing package: exit 1; --json stderr not_installed", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p6f-why-missing");
    writeTransitiveLock(project.cwd);

    const human = await runInProject(project.cwd, ["deps", "why", "missing-pkg"]);
    expectKnownCommand(human.combined, "deps");
    expect(human.result).toBe(1);

    const json = await runInProject(project.cwd, ["deps", "why", "missing-pkg", "--json"]);
    expectKnownCommand(json.combined, "deps");
    expectKnownFlag(json.combined, "--json");
    expect(json.result).toBe(1);
    const err = parseJsonStderr(json.stderr);
    expect(err.error).toBe("not_installed");
  });

  test("missing lock: exit 2; --json stderr no_lockfile", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p6f-why-nolock");

    const human = await runInProject(project.cwd, ["deps", "why", "anything"]);
    expectKnownCommand(human.combined, "deps");
    expect(human.result).toBe(2);

    const json = await runInProject(project.cwd, ["deps", "why", "x", "--json"]);
    expectKnownCommand(json.combined, "deps");
    expectKnownFlag(json.combined, "--json");
    expect(json.result).toBe(2);
    const err = parseJsonStderr(json.stderr);
    expect(err.error).toBe("no_lockfile");
  });

  test("query matches exact name and exact repo_url", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p6f-why-match");
    writeTransitiveLock(project.cwd);

    const byName = await runInProject(project.cwd, ["deps", "why", "org/parent"]);
    expectKnownCommand(byName.combined, "deps");
    expect(byName.result).toBe(0);
    expect(stdoutText(byName.stdout)).toMatch(/org\/parent/i);

    // Must resolve lock entry by repo_url (not echo the query as a fake chain).
    const byUrl = await runInProject(project.cwd, [
      "deps",
      "why",
      "https://example.com/org/child.git",
      "--json",
    ]);
    expectKnownCommand(byUrl.combined, "deps");
    expectKnownFlag(byUrl.combined, "--json");
    expect(byUrl.result).toBe(0);
    const doc = parseJsonStdout(byUrl.stdout);
    const pkg = doc.package as Record<string, unknown>;
    expect(pkg.name).toBe("org/child");
    expect(pkg.repo_url).toBe("https://example.com/org/child.git");
    const paths = doc.paths as Array<{ chain: Array<Record<string, unknown>> }>;
    const mentionsParent = paths.some((p) =>
      (p.chain ?? []).some((n) => asText(n.name ?? n.repo_url ?? "").includes("parent")),
    );
    expect(mentionsParent).toBe(true);
  });

  test("human why success still prints readable chain text", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p6f-why-human");
    writeTransitiveLock(project.cwd);

    const { result, stdout, combined } = await runInProject(project.cwd, [
      "deps",
      "why",
      "org/child",
    ]);
    expectKnownCommand(combined, "deps");
    expect(result).toBe(0);
    const text = stdoutText(stdout);
    expect(text).toMatch(/parent/i);
    expect(text).toMatch(/child/i);
    expect(text).toMatch(/→|->|\+--|chain/i);
  });

  test("is_direct follows manifest/depth, not empty resolved_by", async () => {
    project = createTempProject();
    writeText(
      join(project.cwd, "bapm.yml"),
      `name: root
version: 0.0.1
dependencies:
  apm:
    - https://example.com/org/foo.git
`,
    );
    writeLock(
      project.cwd,
      `lockfile_version: "1"
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
`,
    );

    const direct = await runInProject(project.cwd, ["deps", "why", "foo", "--json"]);
    expect(direct.result).toBe(0);
    const directDoc = parseJsonStdout(direct.stdout);
    expect((directDoc.package as Record<string, unknown>).is_direct).toBe(true);
    const directPaths = directDoc.paths as Array<{ chain: Array<Record<string, unknown>> }>;
    expect(directPaths[0]?.chain.map((n) => asText(n.name ?? ""))).toEqual(["foo"]);

    const transitive = await runInProject(project.cwd, ["deps", "why", "foo-bar", "--json"]);
    expect(transitive.result).toBe(0);
    expect((parseJsonStdout(transitive.stdout).package as Record<string, unknown>).is_direct).toBe(
      false,
    );
  });

  test("empty lock still treats missing package as exit 1", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "p6f-why-empty-lock");
    writeEmptyLock(project.cwd);

    const { result, combined } = await runInProject(project.cwd, ["deps", "why", "nope"]);
    expectKnownCommand(combined, "deps");
    expect(result).toBe(1);
  });
});

function stderrTextSafe(stderr: string[]): string {
  return stderr.join("\n");
}
