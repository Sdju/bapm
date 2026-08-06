/**
 * Owner labels, --source origin, --path why (find-reverse-index).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  invokeFind,
  sampleFindLockYaml,
  writeLock,
  writeManifest,
  type TempProject,
} from "./helpers.ts";

describe("mp-find labels / source / path", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("default owner line prefers repo_url over name", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "mp-find-label");
    writeLock(project.cwd, sampleFindLockYaml());

    const result = await invokeFind({
      cwd: project.cwd,
      path: "AGENTS.md",
      query: "AGENTS.md",
    });
    expect(result.exitCode).toBe(0);
    expect(result.text).toMatch(/https:\/\/example\.com\/org\/alpha\.git/);
    // First owner line should not prefer bare name when repo_url is set
    const firstLine = result.text
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0);
    expect(firstLine).toMatch(/https:\/\/example\.com\/org\/alpha\.git/);
  });

  test("workspace owner prints '.' and --source annotates workspace", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "mp-find-local");
    writeLock(project.cwd, sampleFindLockYaml());

    const plain = await invokeFind({
      cwd: project.cwd,
      path: "notes/local.md",
      query: "notes/local.md",
    });
    expect(plain.exitCode).toBe(0);
    expect(plain.text).toMatch(/^\./m);

    const sourced = await invokeFind({
      cwd: project.cwd,
      path: "notes/local.md",
      query: "notes/local.md",
      source: true,
      showSource: true,
    });
    expect(sourced.exitCode).toBe(0);
    expect(sourced.text).toMatch(/\. {2}\(workspace\)|\.\s+\(workspace\)/);
  });

  test("--source prefers repo@resolved_ref over bare repo_url", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "mp-find-source");
    writeLock(project.cwd, sampleFindLockYaml());

    const result = await invokeFind({
      cwd: project.cwd,
      path: "AGENTS.md",
      query: "AGENTS.md",
      source: true,
      showSource: true,
    });
    expect(result.exitCode).toBe(0);
    expect(result.text).toMatch(/@main|resolved_ref|alpha\.git@main/i);
  });

  test("--path prints indented why chains (bapm.yml, not apm.yml)", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "mp-find-path");
    writeLock(project.cwd, sampleFindLockYaml());

    const result = await invokeFind({
      cwd: project.cwd,
      path: "AGENTS.md",
      query: "AGENTS.md",
      why: true,
      showPath: true,
      pathDetail: true,
    });
    expect(result.exitCode).toBe(0);
    expect(result.text).toMatch(/https:\/\/example\.com\/org\/alpha\.git|org\/alpha/);
    // Indented chain detail or arrow join from why walker
    expect(result.text).toMatch(/\n\s+\S+|→|->/);
    expect(result.text).not.toMatch(/\bapm\.yml\b/);
  });

  test("empty why falls back to owner label without failing", async () => {
    project = createTempProject();
    writeManifest(project.cwd, "mp-find-empty-why");
    // Direct-only dep with no resolved_by parents → why may be a single-node or empty;
    // either way find must still print the label and exit 0.
    writeLock(
      project.cwd,
      `lockfile_version: "1"
dependencies:
  - name: solo/pkg
    repo_url: https://example.com/solo/pkg.git
    source: git
    resolved_commit: "cccccccccccccccccccccccccccccccccccccccc"
    deployed_file_hashes:
      only.md: deadbeef
`,
    );

    const result = await invokeFind({
      cwd: project.cwd,
      path: "only.md",
      query: "only.md",
      why: true,
      showPath: true,
      pathDetail: true,
    });
    expect(result.exitCode).toBe(0);
    expect(result.text).toMatch(/https:\/\/example\.com\/solo\/pkg\.git|solo\/pkg/);
  });
});
