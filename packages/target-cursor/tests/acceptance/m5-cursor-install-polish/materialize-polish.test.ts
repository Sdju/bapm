/**
 * M5 acceptance: skills harden + instructions→rules + agents→agents + no MCP.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCursorTarget } from "../../../src/index.ts";

function listFilesRecursive(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(p.slice(root.length + 1));
    }
  };
  walk(root);
  return out;
}

describe("M5 cursor materialize polish", () => {
  let cwd: string;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
  });

  test("skills re-materialize is idempotent under .agents/skills", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-m5-skills-"));
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
    const src = join(cwd, "src-skill", "SKILL.md");
    mkdirSync(join(cwd, "src-skill"), { recursive: true });
    const body = "---\nname: hello\n---\n# Hello skill\n";
    writeFileSync(src, body, "utf8");

    const target = createCursorTarget();
    const primitives = [
      { name: "hello", type: "skill", source: "local" as const, path: src },
    ];
    const ctx = { cwd, targetId: "cursor", deployRoots: target.deployRoots };

    await target.materialize(primitives, ctx);
    await target.materialize(primitives, ctx);

    const dest = join(cwd, ".agents", "skills", "hello", "SKILL.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toBe(body);
    expect(existsSync(join(cwd, "hello", "SKILL.md"))).toBe(false);
  });

  test("instructions deploy to .cursor/rules/<name>.mdc", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-m5-instr-"));
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
    const src = join(cwd, "src-instr", "style.md");
    mkdirSync(join(cwd, "src-instr"), { recursive: true });
    writeFileSync(src, "# Style rule\n", "utf8");

    const target = createCursorTarget();
    expect(target.deployRoots).toEqual(
      expect.arrayContaining([".agents/skills", ".cursor"]),
    );

    await target.materialize(
      [{ name: "style", type: "instruction", source: "local", path: src }],
      { cwd, targetId: "cursor", deployRoots: target.deployRoots },
    );

    const dest = join(cwd, ".cursor", "rules", "style.mdc");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toMatch(/Style rule/);
    expect(existsSync(join(cwd, ".cursor", "mcp.json"))).toBe(false);
  });

  test("agents deploy to .cursor/agents/<name>.md", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-m5-agent-"));
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
    const src = join(cwd, "src-agent", "reviewer.md");
    mkdirSync(join(cwd, "src-agent"), { recursive: true });
    writeFileSync(src, "# Reviewer agent\n", "utf8");

    const target = createCursorTarget();
    await target.materialize(
      [{ name: "reviewer", type: "agent", source: "local", path: src }],
      { cwd, targetId: "cursor", deployRoots: target.deployRoots },
    );

    const dest = join(cwd, ".cursor", "agents", "reviewer.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toMatch(/Reviewer agent/);
  });

  test("materialize never writes outside registered roots and never writes mcp.json", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-m5-roots-"));
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
    const skillSrc = join(cwd, "s", "SKILL.md");
    mkdirSync(join(cwd, "s"), { recursive: true });
    writeFileSync(skillSrc, "---\nname: x\n---\n# X\n", "utf8");
    const instrSrc = join(cwd, "i.md");
    writeFileSync(instrSrc, "# I\n", "utf8");

    const target = createCursorTarget();
    await target.materialize(
      [
        { name: "x", type: "skill", source: "local", path: skillSrc },
        { name: "i", type: "instruction", source: "local", path: instrSrc },
      ],
      { cwd, targetId: "cursor", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(cwd, ".cursor", "mcp.json"))).toBe(false);
    expect(existsSync(join(cwd, "x", "SKILL.md"))).toBe(false);
    expect(existsSync(join(cwd, "i.mdc"))).toBe(false);

    const outside = listFilesRecursive(cwd).filter(
      (rel) =>
        !rel.startsWith(".agents/") &&
        !rel.startsWith(".cursor/") &&
        rel !== "s/SKILL.md" &&
        rel !== "i.md",
    );
    expect(outside).toEqual([]);
  });

  test("materialize reports deployed paths via api contract", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-m5-report-"));
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
    const src = join(cwd, "src-skill", "SKILL.md");
    mkdirSync(join(cwd, "src-skill"), { recursive: true });
    writeFileSync(src, "---\nname: reported\n---\n# Reported\n", "utf8");

    const target = createCursorTarget();
    const result = await target.materialize(
      [{ name: "reported", type: "skill", source: "local", path: src }],
      { cwd, targetId: "cursor", deployRoots: target.deployRoots },
    );

    expect(result).toBeTruthy();
    const report = result as {
      deployedFiles?: Array<{ path: string; hash?: string }>;
      deployedPaths?: string[];
    };
    const paths =
      report.deployedFiles?.map((f) => f.path) ??
      report.deployedPaths ??
      [];
    expect(paths.some((p) => p.includes(".agents/skills/reported"))).toBe(true);
  });
});
