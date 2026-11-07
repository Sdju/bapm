/**
 * Install-from-archive extract is additive: never deletes project files,
 * never writes next to the project, fails closed on differing overwrites.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { extractPackArchive } from "../../src/index.ts";

const MANIFEST = "name: from-zip\nversion: 1.0.0\n";

describe("install-from-archive merge extract", () => {
  let parent: string | undefined;

  afterEach(() => {
    if (parent) rmSync(parent, { recursive: true, force: true });
    parent = undefined;
  });

  function setup(): { project: string; archivePath: string } {
    parent = mkdtempSync(join(tmpdir(), "bapm-archive-merge-"));
    const project = join(parent, "project");
    mkdirSync(join(project, ".git"), { recursive: true });
    writeFileSync(join(project, ".git", "HEAD"), "ref: refs/heads/main\n");
    writeFileSync(join(project, "notes.txt"), "keep me\n");
    const archivePath = join(parent, "pkg.zip");
    writeFileSync(
      archivePath,
      zipSync({
        "bapm.yml": strToU8(MANIFEST),
        ".apm/skills/hi/SKILL.md": strToU8("---\nname: hi\n---\nhi\n"),
      }),
    );
    return { project, archivePath };
  }

  test("keeps .git and unrelated files, lands archive members", async () => {
    const { project, archivePath } = setup();

    await extractPackArchive({ archivePath, outputDir: project, cwd: project });

    expect(readFileSync(join(project, ".git", "HEAD"), "utf8")).toBe("ref: refs/heads/main\n");
    expect(readFileSync(join(project, "notes.txt"), "utf8")).toBe("keep me\n");
    expect(readFileSync(join(project, "bapm.yml"), "utf8")).toBe(MANIFEST);
    expect(existsSync(join(project, ".apm", "skills", "hi", "SKILL.md"))).toBe(true);
  });

  test("writes nothing next to the project", async () => {
    const { project, archivePath } = setup();
    const before = readdirSync(parent!).sort();

    await extractPackArchive({ archivePath, outputDir: project, cwd: project });

    expect(readdirSync(parent!).sort()).toEqual(before);
    expect(readdirSync(project).filter((n) => n.startsWith(".bapm"))).toEqual([]);
  });

  test("differing existing file fails closed before any write", async () => {
    const { project, archivePath } = setup();
    writeFileSync(join(project, "bapm.yml"), "name: mine\nversion: 0.0.1\n");

    await expect(
      extractPackArchive({ archivePath, outputDir: project, cwd: project }),
    ).rejects.toThrow(/bapm\.yml/);

    expect(readFileSync(join(project, "bapm.yml"), "utf8")).toBe("name: mine\nversion: 0.0.1\n");
    expect(existsSync(join(project, ".apm"))).toBe(false);
    expect(readFileSync(join(project, "notes.txt"), "utf8")).toBe("keep me\n");
  });

  test("identical existing file is not a conflict", async () => {
    const { project, archivePath } = setup();
    writeFileSync(join(project, "bapm.yml"), MANIFEST);

    await extractPackArchive({ archivePath, outputDir: project, cwd: project });

    expect(existsSync(join(project, ".apm", "skills", "hi", "SKILL.md"))).toBe(true);
  });
});
