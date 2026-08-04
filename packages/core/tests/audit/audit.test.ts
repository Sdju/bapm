/**
 * Core audit --ci / integrity — checklist C §17–21.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { join } from "node:path";
import {
  createTempProject,
  diagnosticsText,
  exitCodeOf,
  getRunAuditCi,
  sha256Hex,
  writeLock,
  writeManifest,
  writeText,
  type TempProject,
} from "../lifecycle/helpers.ts";

describe("core audit --ci (lk-017 / sc-001)", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("§17 audit --ci clean inventory exits 0", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: audit-clean\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );
    const rel = ".agents/skills/hello/SKILL.md";
    const content = "---\nname: hello\n---\n# Hello\n";
    writeText(join(project.cwd, rel), content);
    const hash = sha256Hex(content);
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n    deployed_file_hashes:\n      "${rel}": "${hash}"\n`,
    );

    const result = await getRunAuditCi()({ cwd: project.cwd, ci: true });
    expect(exitCodeOf(result)).toBe(0);
  });

  test("§18 tampered deployed file → exit 1 with path + expected/observed", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: audit-tamper\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );
    const rel = ".agents/skills/hello/SKILL.md";
    const good = "---\nname: hello\n---\n# Hello\n";
    const goodHash = sha256Hex(good);
    writeText(join(project.cwd, rel), "TAMPERED\n");
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n    deployed_file_hashes:\n      "${rel}": "${goodHash}"\n`,
    );

    const result = await getRunAuditCi()({ cwd: project.cwd, ci: true });
    expect(exitCodeOf(result)).toBe(1);
    const diag = diagnosticsText(result);
    expect(diag).toMatch(/SKILL\.md|hello|\.agents/i);
    expect(diag).toMatch(/expected|want|recorded/i);
    expect(diag).toMatch(/observed|actual|got|found/i);
  });

  test("§19 missing deployed file → exit 1", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: audit-missing-file\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );
    const rel = ".agents/skills/gone/SKILL.md";
    const hash = sha256Hex("missing\n");
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: local:leaf\n    name: leaf\n    source: local\n    path: leaf\n    deployed_file_hashes:\n      "${rel}": "${hash}"\n`,
    );

    const result = await getRunAuditCi()({ cwd: project.cwd, ci: true });
    expect(exitCodeOf(result)).toBe(1);
    expect(diagnosticsText(result)).toMatch(/gone|SKILL\.md|missing|not found|absent/i);
  });

  test("§20 missing lock in CI → non-zero", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: audit-nolock\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );

    const result = await getRunAuditCi()({ cwd: project.cwd, ci: true });
    expect(exitCodeOf(result)).not.toBe(0);
  });

  test("§21 missing tree_sha256 on git entry fails CI gate (lk-015)", async () => {
    project = createTempProject();
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: audit-no-tree\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
    );
    const rel = ".agents/skills/hello/SKILL.md";
    const content = "ok\n";
    writeText(join(project.cwd, rel), content);
    writeLock(
      project.cwd,
      "bapm.lock.yaml",
      `lockfile_version: "1"\ndependencies:\n  - repo_url: github.com/example/git-pkg\n    name: git-pkg\n    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"\n    deployed_file_hashes:\n      "${rel}": "${sha256Hex(content)}"\n`,
    );

    const result = await getRunAuditCi()({ cwd: project.cwd, ci: true });
    expect(exitCodeOf(result)).not.toBe(0);
    expect(diagnosticsText(result)).toMatch(/git-pkg|tree_sha256/i);
  });
});
