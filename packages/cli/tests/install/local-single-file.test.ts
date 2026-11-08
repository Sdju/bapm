/**
 * CLI install accepts local single-file dependencies and deploys through the
 * registered Cursor target, then enforces frozen content drift.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  linkCursorIntegration,
  runInProject,
  type TempProject,
} from "./helpers.ts";

const AGENT = "---\ndescription: Scout\n---\n# Scout\n";
const INSTRUCTION = "---\napplyTo: '**'\n---\n# Style\n";
const PROMPT = "---\ndescription: Review\n---\n# Review\n";

describe("CLI install · local single-file", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  function writeProject(cwd: string): void {
    const spec = linkCursorIntegration(cwd);
    writeFileSync(
      join(cwd, "bapm.yml"),
      [
        "name: cli-local-single-file",
        "version: 0.0.1",
        `targets:\n  cursor: "${spec}"`,
        "dependencies:",
        "  apm:",
        "    - path: ./ai/scout.agent.md",
        "    - path: ./ai/style.instructions.md",
        "    - path: ./ai/review.prompt.md",
        "",
      ].join("\n"),
      "utf8",
    );
    for (const [name, content] of [
      ["scout.agent.md", AGENT],
      ["style.instructions.md", INSTRUCTION],
      ["review.prompt.md", PROMPT],
    ] as const) {
      mkdirSync(join(cwd, "ai"), { recursive: true });
      writeFileSync(join(cwd, "ai", name), content, "utf8");
    }
  }

  test("install deploys all three suffixes and frozen rejects file drift", async () => {
    project = createTempProject("bapm-cli-local-file-");
    const cwd = project.cwd;
    writeProject(cwd);

    const first = await runInProject(cwd, ["install", "--target", "cursor"]);
    expect(first.combined).not.toMatch(/unsupported single-file|frontmatter|symlink/i);
    expect(first.result).toBe(0);
    expect(readFileSync(join(cwd, ".cursor/agents/scout.md"), "utf8")).toBe(AGENT);
    expect(readFileSync(join(cwd, ".cursor/rules/style.mdc"), "utf8")).toBe(INSTRUCTION);
    expect(readFileSync(join(cwd, ".cursor/commands/review.md"), "utf8")).toBe(PROMPT);

    const frozen = await runInProject(cwd, ["install", "--frozen", "--target", "cursor"]);
    expect(frozen.result).toBe(0);

    writeFileSync(join(cwd, "ai/scout.agent.md"), "---\ndescription: Changed\n---\n# Changed\n");
    const drift = await runInProject(cwd, ["install", "--frozen", "--target", "cursor"]);
    expect(drift.result).not.toBe(0);
    expect(drift.combined).toMatch(/content changed|content_hash|INSTALL_FROZEN_UNDER_RECORDED/i);
    // Frozen drift fails before harness rewrite.
    expect(readFileSync(join(cwd, ".cursor/agents/scout.md"), "utf8")).toBe(AGENT);
  });
});
