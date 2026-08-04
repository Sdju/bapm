/**
 * bapm-target-cursor package identity and skills materialize unit.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCursorTarget } from "../src/index.ts";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("bapm-target-cursor package", () => {
  test("package is bapm-target-cursor depending on bapm-target-api only", () => {
    expect(existsSync(pkgRoot)).toBe(true);
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
      name?: string;
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.name).toBe("bapm-target-cursor");
    expect(pkg.dependencies?.["bapm-target-api"]).toBeTruthy();
    expect(pkg.dependencies?.["@bapm/core"]).toBeUndefined();
    expect(JSON.stringify(pkg.scripts ?? {})).toMatch(/vp/);
  });
});

describe("createCursorTarget", () => {
  let cwd: string;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
  });

  test("detects .cursor and materializes skill under .agents/skills", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-cursor-"));
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
    const src = join(cwd, "src-skill", "SKILL.md");
    mkdirSync(join(cwd, "src-skill"), { recursive: true });
    writeFileSync(src, "---\nname: hello\n---\n# Hello\n", "utf8");

    const target = createCursorTarget();
    expect(target.id).toBe("cursor");
    expect(target.deployRoots).toEqual(expect.arrayContaining([".agents/skills"]));
    expect(target.detect({ cwd })).toBe(true);

    await target.materialize(
      [
        {
          name: "hello",
          type: "skill",
          source: "local",
          path: src,
        },
      ],
      { cwd, targetId: "cursor", deployRoots: target.deployRoots },
    );

    const dest = join(cwd, ".agents", "skills", "hello", "SKILL.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toMatch(/Hello/);
    expect(existsSync(join(cwd, "hello", "SKILL.md"))).toBe(false);
  });
});
