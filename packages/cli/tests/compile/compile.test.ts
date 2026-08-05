/**
 * M9 MUST: thin bapm compile → AGENTS.md (cursor).
 * Specs: compile-agents-md. Checklist D §12–15.
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  expectKnownFlags,
  runInProject,
  writeCompileProject,
  type TempProject,
} from "../mcp/helpers.ts";

describe("CLI M9 thin compile → AGENTS.md", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("bapm compile writes AGENTS.md from discoverable primitives; exit 0", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);

    const { result, combined } = await runInProject(project.cwd, ["compile"]);
    expectKnownFlags(combined);
    expect(combined).not.toMatch(/unknown command|not a real command|not implemented/i);
    expect(result).toBe(0);

    const agents = join(project.cwd, "AGENTS.md");
    expect(existsSync(agents)).toBe(true);
    expect(readFileSync(agents, "utf8")).toMatch(/Style|concise/i);
  });

  test("two compiles without input change → identical AGENTS.md body", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);

    const first = await runInProject(project.cwd, ["compile"]);
    expect(first.result).toBe(0);
    const body1 = readFileSync(join(project.cwd, "AGENTS.md"));

    const second = await runInProject(project.cwd, ["compile"]);
    expect(second.result).toBe(0);
    const body2 = readFileSync(join(project.cwd, "AGENTS.md"));
    expect(Buffer.compare(body1, body2)).toBe(0);
  });

  test("compile MUST NOT emit foreign-host files", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);

    const { result } = await runInProject(project.cwd, ["compile"]);
    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, "CLAUDE.md"))).toBe(false);
    expect(existsSync(join(project.cwd, "GEMINI.md"))).toBe(false);
    expect(existsSync(join(project.cwd, ".github", "copilot-instructions.md"))).toBe(false);
    expect(existsSync(join(project.cwd, ".claude"))).toBe(false);
  });

  test("--validate leaves AGENTS.md untouched", async () => {
    project = createTempProject();
    writeCompileProject(project.cwd);
    const { result } = await runInProject(project.cwd, ["compile", "--validate"]);
    expect(result).toBe(0);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
  });
});
