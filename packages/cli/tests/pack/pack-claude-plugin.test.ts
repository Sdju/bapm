/**
 * CLI `pack --format claude-plugin` — Claude plugin bundle with native manifest.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractPackArchive } from "@b-apm/core";
import { createTempProject, expectKnownCommand, runInProject, writeText } from "./helpers.ts";

let project: ReturnType<typeof createTempProject> | undefined;
let extracted: string | undefined;

afterEach(() => {
  project?.cleanup();
  project = undefined;
  if (extracted) rmSync(extracted, { recursive: true, force: true });
  extracted = undefined;
});

function writeClaudeTree(cwd: string): void {
  writeText(
    cwd,
    "plugin.json",
    `${JSON.stringify(
      {
        name: "cli-claude",
        version: "1.0.0",
        commands: ["./commands/ship.md"],
        hooks: ["./hooks/session.json"],
        skills: ["hello"],
      },
      null,
      2,
    )}\n`,
  );
  writeText(cwd, "bapm.yml", 'name: cli-claude\nversion: "1.0.0"\ndependencies:\n  apm: []\n');
  writeText(cwd, "commands/ship.md", "# Ship\n");
  writeText(
    cwd,
    "hooks/session.json",
    `${JSON.stringify({ hooks: { SessionStart: [{ command: "./hooks/run.sh" }] } }, null, 2)}\n`,
  );
  writeText(cwd, "hooks/run.sh", "#!/bin/sh\necho hook\n");
  writeText(cwd, "hooks/assets/prompt.txt", "hook sibling asset\n");
  writeText(cwd, "skills/hello/SKILL.md", "---\nname: hello\n---\n# Hello\n");
  writeText(cwd, "skills/hello/guide.md", "# Guide\n");
  writeText(cwd, "agents/reviewer.md", "# Reviewer\n");
}

describe("CLI pack --format claude-plugin", () => {
  test("writes a Claude plugin zip with native manifest and complete tree", async () => {
    project = createTempProject("bapm-cli-claude-pack-");
    writeClaudeTree(project.cwd);

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--format",
      "claude-plugin",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(0);

    const zip = join(project.cwd, "cli-claude-1.0.0.zip");
    expect(existsSync(zip)).toBe(true);

    extracted = join(tmpdir(), `bapm-cli-claude-extract-${Date.now()}`);
    mkdirSync(extracted, { recursive: true });
    await extractPackArchive({ archivePath: zip, outputDir: extracted });

    expect(readFileSync(join(extracted, "commands/ship.md"), "utf8")).toBe("# Ship\n");
    expect(readFileSync(join(extracted, "hooks/run.sh"), "utf8")).toBe("#!/bin/sh\necho hook\n");
    expect(readFileSync(join(extracted, "hooks/assets/prompt.txt"), "utf8")).toBe(
      "hook sibling asset\n",
    );
    expect(readFileSync(join(extracted, "skills/hello/guide.md"), "utf8")).toBe("# Guide\n");
    expect(existsSync(join(extracted, "agents/reviewer.md"))).toBe(true);
    expect(existsSync(join(extracted, ".claude-plugin/plugin.json"))).toBe(true);
    expect(readFileSync(join(extracted, "plugin.json"), "utf8")).toContain("cli-claude");
    expect(existsSync(join(extracted, "bapm.yml"))).toBe(false);
  });

  test("missing declared path exits non-zero without a zip", async () => {
    project = createTempProject("bapm-cli-claude-missing-");
    writeText(
      project.cwd,
      "plugin.json",
      JSON.stringify({
        name: "cli-claude-missing",
        version: "1.0.0",
        hooks: ["./hooks/absent.json"],
      }),
    );

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--format=claude-plugin",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).not.toBe(0);
    expect(combined).toMatch(/absent|missing|hooks|declared/i);
    expect(existsSync(join(project.cwd, "cli-claude-missing-1.0.0.zip"))).toBe(false);
  });
});
