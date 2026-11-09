import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { compilePrimitivesMarkdown } from "../src/index.ts";
import type { AttributedPrimitive, CompileContext } from "../src/index.ts";

function prim(
  partial: Partial<AttributedPrimitive> & Pick<AttributedPrimitive, "name" | "type">,
): AttributedPrimitive {
  return {
    source: "local",
    path: `/tmp/${partial.name}`,
    content: `# body ${partial.name}`,
    ...partial,
  };
}

function context(cwd: string, write: boolean, extra: Partial<CompileContext> = {}): CompileContext {
  return { cwd, write, ...extra };
}

const PRIMITIVES = [
  prim({ name: "skill-a", type: "skill" }),
  prim({ name: "rule-a", type: "instruction" }),
  prim({ name: "agent-a", type: "agent" }),
];

describe("compilePrimitivesMarkdown", () => {
  test("includes instructions by default", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-compile-"));
    const report = compilePrimitivesMarkdown(PRIMITIVES, context(cwd, false), {
      title: "# AGENTS.md",
      defaultOutput: "AGENTS.md",
    });
    expect(report.path).toBe("AGENTS.md");
    expect(report.wrote).toBe(false);
    expect(report.content).toContain("## skill-a (skill)");
    expect(report.content).toContain("## rule-a (instruction)");
  });

  test("omits instructions unless includeInstructions is set", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-compile-"));
    const omitted = compilePrimitivesMarkdown(PRIMITIVES, context(cwd, false), {
      title: "# CLAUDE.md",
      defaultOutput: "CLAUDE.md",
      instructions: "omit",
    });
    expect(omitted.content).not.toContain("## rule-a (instruction)");
    expect(omitted.content).toContain("## skill-a (skill)");

    const included = compilePrimitivesMarkdown(
      PRIMITIVES,
      context(cwd, false, { includeInstructions: true }),
      {
        title: "# CLAUDE.md",
        defaultOutput: "CLAUDE.md",
        instructions: "omit",
      },
    );
    expect(included.content).toContain("## rule-a (instruction)");
  });

  test("only renders instructions when requested", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-compile-"));
    const report = compilePrimitivesMarkdown(PRIMITIVES, context(cwd, false), {
      title: "# GEMINI.md",
      defaultOutput: "GEMINI.md",
      instructions: "only",
      sectionHeading: (p) => String(p.name),
    });
    expect(report.content).toContain("## rule-a");
    expect(report.content).not.toContain("## skill-a");
    expect(report.content).not.toContain("## agent-a");
  });

  test("writes under cwd and applies the basename gate", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-compile-"));
    const report = compilePrimitivesMarkdown(PRIMITIVES, context(cwd, true), {
      title: "# AGENTS.md",
      defaultOutput: "nested/AGENTS.md",
      requireBasename: "AGENTS.md",
    });
    expect(report.wrote).toBe(true);
    expect(existsSync(join(cwd, "nested", "AGENTS.md"))).toBe(true);
    expect(readFileSync(join(cwd, "nested", "AGENTS.md"), "utf8")).toBe(report.content);
  });

  test("rejects output escaping cwd", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-compile-"));
    expect(() =>
      compilePrimitivesMarkdown(PRIMITIVES, context(cwd, true), {
        title: "# AGENTS.md",
        defaultOutput: "../AGENTS.md",
      }),
    ).toThrow(/cwd-relative/);
  });
});
