/**
 * CLI opt-in distributed compile: --distributed / --strategy applyTo placement,
 * no-write modes, target selection, and -o rejection.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, linkIntegration, type TempProject } from "./helpers.ts";
import { runInProject } from "../integrations/map-load-helpers.ts";

function writeDistributedProject(
  cwd: string,
  instructions: Record<string, string>,
  ids: string[] = ["cursor"],
): void {
  mkdirSync(join(cwd, ".cursor"), { recursive: true });
  mkdirSync(join(cwd, ".apm", "instructions"), { recursive: true });
  for (const id of ids) linkIntegration(cwd, id);
  writeFileSync(
    join(cwd, "bapm.yml"),
    "name: compile-distributed-cli\nversion: 0.0.1\ndependencies:\n  apm: []\n",
    "utf8",
  );
  for (const [name, contents] of Object.entries(instructions)) {
    writeFileSync(join(cwd, ".apm", "instructions", name), contents, "utf8");
  }
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("CLI compile --distributed", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("--distributed writes src/AGENTS.md from applyTo src/**", async () => {
    project = createTempProject();
    writeDistributedProject(project.cwd, {
      "style.md": '---\ndescription: Style\napplyTo: "src/**"\n---\n\n# Style\nDistributed rule.\n',
    });

    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--target",
      "cursor",
      "--distributed",
    ]);

    expect(combined).not.toMatch(/unknown compile flag|unexpected compile argument/i);
    expect(result, combined).toBe(0);
    expect(existsSync(join(project.cwd, "src", "AGENTS.md"))).toBe(true);
    expect(read(join(project.cwd, "src", "AGENTS.md"))).toMatch(/Distributed rule/);
    expect(existsSync(join(project.cwd, "AGENTS.md"))).toBe(false);
    expect(combined).toMatch(/Wrote src\/AGENTS\.md/);
  });

  test("--strategy distributed is equivalent to --distributed", async () => {
    project = createTempProject();
    writeDistributedProject(project.cwd, {
      "style.md": '---\ndescription: Style\napplyTo: "docs/*.md"\n---\n\n# Style\nDocs rule.\n',
    });

    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--target",
      "cursor",
      "--strategy",
      "distributed",
    ]);

    expect(result, combined).toBe(0);
    expect(existsSync(join(project.cwd, "docs", "AGENTS.md"))).toBe(true);
  });

  test("--strategy single-file keeps the default single-file behavior", async () => {
    project = createTempProject();
    writeDistributedProject(project.cwd, {
      "style.md": '---\ndescription: Style\napplyTo: "src/**"\n---\n\n# Style\nRoot rule.\n',
    });

    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--target",
      "cursor",
      "--strategy",
      "single-file",
    ]);

    expect(result, combined).toBe(0);
    expect(read(join(project.cwd, "AGENTS.md"))).toMatch(/Root rule/);
    expect(existsSync(join(project.cwd, "src", "AGENTS.md"))).toBe(false);
  });

  test("--distributed --dry-run previews without writing", async () => {
    project = createTempProject();
    writeDistributedProject(project.cwd, {
      "style.md": '---\ndescription: Style\napplyTo: "src/**"\n---\n\n# Style\nPreview.\n',
    });

    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--target",
      "cursor",
      "--distributed",
      "--dry-run",
    ]);

    expect(result, combined).toBe(0);
    expect(combined).toMatch(/would write src\/AGENTS\.md/);
    expect(existsSync(join(project.cwd, "src", "AGENTS.md"))).toBe(false);
  });

  test("--distributed --validate does not write", async () => {
    project = createTempProject();
    writeDistributedProject(project.cwd, {
      "style.md": '---\ndescription: Style\napplyTo: "src/**"\n---\n\n# Style\nValidate.\n',
    });

    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--target",
      "cursor",
      "--distributed",
      "--validate",
    ]);

    expect(result, combined).toBe(0);
    expect(combined).toMatch(/compile --validate ok/i);
    expect(existsSync(join(project.cwd, "src", "AGENTS.md"))).toBe(false);
  });

  test("--distributed rejects -o", async () => {
    project = createTempProject();
    writeDistributedProject(project.cwd, {
      "style.md": '---\ndescription: Style\napplyTo: "src/**"\n---\n\n# Style\nNo override.\n',
    });

    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--target",
      "cursor",
      "--distributed",
      "-o",
      "OUT.md",
    ]);

    expect(result).not.toBe(0);
    expect(combined).toMatch(/distributed.*--output|--output.*distributed/i);
    expect(existsSync(join(project.cwd, "OUT.md"))).toBe(false);
    expect(existsSync(join(project.cwd, "src", "AGENTS.md"))).toBe(false);
  });

  test("global instructions stay in root while applyTo goes to subdirectories", async () => {
    project = createTempProject();
    writeDistributedProject(project.cwd, {
      "global.md": "---\ndescription: Global\n---\n\n# Global\nEverywhere.\n",
      "style.md": '---\ndescription: Style\napplyTo: "src/**"\n---\n\n# Style\nOnly src.\n',
    });

    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--target",
      "cursor",
      "--distributed",
    ]);

    expect(result, combined).toBe(0);
    expect(read(join(project.cwd, "AGENTS.md"))).toMatch(/Everywhere/);
    expect(read(join(project.cwd, "AGENTS.md"))).not.toMatch(/Only src/);
    expect(read(join(project.cwd, "src", "AGENTS.md"))).toMatch(/Only src/);
  });

  test("multi-target distributed keeps host-specific output names", async () => {
    project = createTempProject();
    writeDistributedProject(
      project.cwd,
      {
        "style.md": '---\ndescription: Style\napplyTo: "src/**"\n---\n\n# Style\nBoth hosts.\n',
      },
      ["cursor", "claude"],
    );

    const { result, combined } = await runInProject(project.cwd, [
      "compile",
      "--target",
      "cursor,claude",
      "--distributed",
    ]);

    expect(result, combined).toBe(0);
    expect(read(join(project.cwd, "src", "AGENTS.md"))).toMatch(/Both hosts/);
    expect(read(join(project.cwd, "src", "CLAUDE.md"))).toMatch(/Both hosts/);
  });

  test("symlinked applyTo directory is rejected without writes", async () => {
    project = createTempProject();
    writeDistributedProject(project.cwd, {
      "style.md": '---\ndescription: Style\napplyTo: "src/**"\n---\n\n# Style\nSymlink.\n',
    });
    const outside = createTempProject();
    try {
      symlinkSync(outside.cwd, join(project.cwd, "src"), "dir");

      const { result, combined } = await runInProject(project.cwd, [
        "compile",
        "--target",
        "cursor",
        "--distributed",
      ]);

      expect(result).not.toBe(0);
      expect(combined).toMatch(/symlink/i);
      expect(existsSync(join(outside.cwd, "AGENTS.md"))).toBe(false);
    } finally {
      outside.cleanup();
    }
  });
});
