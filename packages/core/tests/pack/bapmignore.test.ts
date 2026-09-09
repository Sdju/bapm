/**
 * Unit tests for project-root `.bapmignore` load/match helper.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, type TempProject } from "./helpers.ts";
import { isBapmIgnored, loadBapmIgnore } from "../../src/modules/Pack/bapmIgnore.ts";

describe("loadBapmIgnore", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("missing file yields empty rules", () => {
    project = createTempProject();
    const rules = loadBapmIgnore(project.cwd);
    expect(isBapmIgnored("README.md", rules)).toBe(false);
    expect(isBapmIgnored("docs/a.md", rules)).toBe(false);
  });

  test("matches README and supports negation", () => {
    project = createTempProject();
    writeFileSync(join(project.cwd, ".bapmignore"), "*.md\n!LICENSE.md\n", "utf8");
    const rules = loadBapmIgnore(project.cwd);
    expect(isBapmIgnored("CHANGELOG.md", rules)).toBe(true);
    expect(isBapmIgnored("LICENSE.md", rules)).toBe(false);
    expect(isBapmIgnored("README.md", rules)).toBe(true);
  });

  test("never ignores root dual-read manifests", () => {
    project = createTempProject();
    writeFileSync(join(project.cwd, ".bapmignore"), "bapm.yml\n*\n", "utf8");
    const rules = loadBapmIgnore(project.cwd);
    expect(isBapmIgnored("bapm.yml", rules)).toBe(false);
    expect(isBapmIgnored("apm.yml", rules)).toBe(false);
    expect(isBapmIgnored("README.md", rules)).toBe(true);
  });

  test("directory collision fails closed", () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".bapmignore"), { recursive: true });
    expect(() => loadBapmIgnore(project!.cwd)).toThrow(/bapmignore|directory|not a file/i);
  });

  test("unreadable file fails closed when chmod works", () => {
    project = createTempProject();
    const path = join(project.cwd, ".bapmignore");
    writeFileSync(path, "README.md\n", "utf8");
    try {
      chmodSync(path, 0);
    } catch {
      return;
    }
    try {
      expect(() => loadBapmIgnore(project!.cwd)).toThrow(/bapmignore|unreadable|Failed to read/i);
    } finally {
      try {
        chmodSync(path, 0o644);
      } catch {
        /* best-effort restore for cleanup */
      }
    }
  });
});
