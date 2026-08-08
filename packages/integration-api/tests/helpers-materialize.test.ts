import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import {
  copyPortableSkillDirectory,
  findPackageRoot,
  isWithin,
  listFiles,
  materializeSkill,
  primitivesMaterialize,
} from "../src/index.ts";

describe("primitivesMaterialize", () => {
  test("dispatches known kinds to typed handlers", async () => {
    const seen: string[] = [];
    await primitivesMaterialize(
      [
        { name: "s", type: "skill", source: "local", path: "/tmp/s" },
        { name: "i", type: "instruction", source: "local", path: "/tmp/i" },
        { name: "a", type: "agent", source: "local", path: "/tmp/a" },
        { name: "c", type: "command", source: "local", path: "/tmp/c" },
        { name: "h", type: "hook", source: "local", path: "/tmp/h" },
      ],
      {
        skill: (p) => {
          seen.push(`skill:${p.name}`);
        },
        instruction: (p) => {
          seen.push(`instruction:${p.name}`);
        },
        agent: (p) => {
          seen.push(`agent:${p.name}`);
        },
        command: (p) => {
          seen.push(`command:${p.name}`);
        },
        hook: (p) => {
          seen.push(`hook:${p.name}`);
        },
      },
    );
    expect(seen).toEqual(["skill:s", "instruction:i", "agent:a", "command:c", "hook:h"]);
  });

  test("passes sanitized name and lowercased type", async () => {
    let ctxName = "";
    let ctxType = "";
    await primitivesMaterialize(
      [{ name: "foo/bar", type: "Skill", source: "local", path: "/tmp/x" }],
      {
        skill(_p, ctx) {
          ctxName = ctx.name;
          ctxType = ctx.type;
        },
      },
    );
    expect(ctxName).toBe("foo-bar");
    expect(ctxType).toBe("skill");
  });

  test("unknown handler receives unmatched types; missing handlers are skipped", async () => {
    const seen: string[] = [];
    await primitivesMaterialize(
      [
        { name: "x", type: "lsp", source: "local", path: "/tmp/x" },
        { name: "y", type: "instruction", source: "local", path: "/tmp/y" },
      ],
      {
        unknown: (p, ctx) => {
          seen.push(`unknown:${p.name}:${ctx.type}`);
        },
      },
    );
    expect(seen).toEqual(["unknown:x:lsp"]);
  });
});

describe("fs helpers", () => {
  test("isWithin and listFiles", () => {
    const root = mkdtempSync(join(tmpdir(), "bapm-api-"));
    const nested = join(root, "a");
    mkdirSync(nested);
    const file = join(nested, "f.txt");
    writeFileSync(file, "ok");
    expect(isWithin(root, file)).toBe(true);
    expect(isWithin(root, join(root, "..", "escape"))).toBe(false);
    expect(
      listFiles(root)
        .map((p) => p.replace(root, ""))
        .sort(),
    ).toEqual(["/a/f.txt"]);
  });

  test("findPackageRoot walks to apm/bapm/plugin marker", () => {
    const root = mkdtempSync(join(tmpdir(), "bapm-pkgroot-"));
    writeFileSync(join(root, "bapm.yml"), "name: x\n");
    const nested = join(root, ".apm", "hooks");
    mkdirSync(nested, { recursive: true });
    const hookFile = join(nested, "hook.json");
    writeFileSync(hookFile, "{}\n");
    expect(findPackageRoot(hookFile)).toBe(root);

    const orphan = mkdtempSync(join(tmpdir(), "bapm-orphan-"));
    const orphanFile = join(orphan, "deep", "x.json");
    mkdirSync(join(orphan, "deep"), { recursive: true });
    writeFileSync(orphanFile, "{}\n");
    expect(findPackageRoot(orphanFile)).toBe(join(orphan, "deep"));
  });

  test("copyPortableSkillDirectory copies contained skill tree", () => {
    const plugin = mkdtempSync(join(tmpdir(), "bapm-plugin-"));
    const skillDir = join(plugin, "skills", "hello");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "# hello\n");
    writeFileSync(join(skillDir, "extra.md"), "x\n");
    const dest = join(mkdtempSync(join(tmpdir(), "bapm-dest-")), "hello");
    copyPortableSkillDirectory(skillDir, plugin, dest);
    expect(listFiles(dest).length).toBe(2);
  });
});

describe("materializeSkill", () => {
  test("copies SKILL.md and reports deployed inventory", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-skill-"));
    const srcDir = join(cwd, "pkg");
    mkdirSync(srcDir);
    writeFileSync(join(srcDir, "SKILL.md"), "# from-src\n");
    const deployed = materializeSkill({
      primitive: {
        name: "hello",
        type: "skill",
        source: "local",
        path: join(srcDir, "SKILL.md"),
        packageName: "pkg",
      },
      cwd,
      deployRoots: [".agents/skills"],
      destDir: join(".agents", "skills", "hello"),
    });
    const dest = join(cwd, ".agents", "skills", "hello", "SKILL.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toBe("# from-src\n");
    expect(deployed).toEqual([
      {
        path: ".agents/skills/hello/SKILL.md",
        primitive: { name: "hello", packageName: "pkg" },
      },
    ]);
  });

  test("copies portable skill directory under destDir", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-skill-ap-"));
    const plugin = join(cwd, "plugin");
    const skillDir = join(plugin, "skills", "hello");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "# ap\n");
    writeFileSync(join(skillDir, "notes.md"), "n\n");
    const deployed = materializeSkill({
      primitive: {
        name: "hello",
        type: "skill",
        source: "dependency:plugin",
        path: join(skillDir, "SKILL.md"),
        format: "agent-plugin",
        skillDirectory: skillDir,
        pluginRoot: plugin,
      },
      cwd,
      deployRoots: [".opencode"],
      destDir: ".opencode/skills/hello",
    });
    expect(deployed.map((d) => d.path).sort()).toEqual([
      ".opencode/skills/hello/SKILL.md",
      ".opencode/skills/hello/notes.md",
    ]);
  });
});
