/**
 * Local single-file dependencies (APM 0.35): `.agent.md`, `.instructions.md`,
 * `.prompt.md` are virtual-file packages with suffix-selected primitive types.
 */
import { symlinkSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { computeLocalSourceContentHash, loadLockfile, resolveAndLock } from "@b-apm/core";
import {
  createTempProject,
  expectRejectsMatching,
  writeManifest,
  writeText,
  type TempProject,
} from "./helpers.ts";

const AGENT = "---\ndescription: Scout\n---\n# Scout\n";
const INSTRUCTION = "---\napplyTo: '**'\n---\n# Style\n";
const PROMPT = "---\ndescription: Review\n---\n# Review\n";

describe("local single-file dependencies", () => {
  const projects: TempProject[] = [];

  afterEach(() => {
    projects.splice(0).forEach((p) => p.cleanup());
  });

  function projectWith(entries: string[]): TempProject {
    const project = createTempProject();
    projects.push(project);
    writeManifest(
      project.cwd,
      "bapm.yml",
      `name: root\nversion: 0.0.1\ndependencies:\n  apm:\n${entries.map((entry) => `    ${entry}\n`).join("")}`,
    );
    return project;
  }

  test("resolves one file of each suffix with APM virtual-file lock fields", async () => {
    const project = projectWith([
      "- path: ./ai/scout.agent.md",
      "- path: ./ai/style.instructions.md",
      "- path: ./ai/review.prompt.md",
    ]);
    writeText(join(project.cwd, "ai/scout.agent.md"), AGENT);
    writeText(join(project.cwd, "ai/style.instructions.md"), INSTRUCTION);
    writeText(join(project.cwd, "ai/review.prompt.md"), PROMPT);

    await resolveAndLock({ cwd: project.cwd });

    const deps = loadLockfile({ cwd: project.cwd }).document.dependencies ?? [];
    expect(deps.map((dep) => String(dep.name)).sort()).toEqual([
      "review.prompt.md",
      "scout.agent.md",
      "style.instructions.md",
    ]);
    for (const filename of ["scout.agent.md", "style.instructions.md", "review.prompt.md"]) {
      const row = deps.find((dep) => dep.name === filename) as Record<string, unknown>;
      expect(row).toMatchObject({
        repo_url: `local:ai/${filename}`,
        source: "local",
        path: `ai/${filename}`,
        local_path: `ai/${filename}`,
        package_type: "local",
        depth: 1,
        resolved_by: `root->${filename}`,
        declaring_parent: "root",
      });
      expect(row.content_hash).toBe(
        computeLocalSourceContentHash(join(project.cwd, "ai", filename)),
      );
      expect(String(row.content_hash)).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });

  test("file content change changes content_hash", async () => {
    const project = projectWith(["- path: ./ai/scout.agent.md"]);
    const source = join(project.cwd, "ai/scout.agent.md");
    writeText(source, AGENT);

    await resolveAndLock({ cwd: project.cwd });
    const first = (loadLockfile({ cwd: project.cwd }).document.dependencies ?? [])[0]!.content_hash;

    writeText(source, "---\ndescription: Scout v2\n---\n# Scout v2\n");
    await resolveAndLock({ cwd: project.cwd });
    const second = (loadLockfile({ cwd: project.cwd }).document.dependencies ?? [])[0]!
      .content_hash;

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
  });

  test("symlinked single file is rejected", async () => {
    const project = projectWith(["- path: ./ai/link.agent.md"]);
    writeText(join(project.cwd, "ai/real.agent.md"), AGENT);
    symlinkSync(join(project.cwd, "ai/real.agent.md"), join(project.cwd, "ai/link.agent.md"));

    const err = await expectRejectsMatching(() => resolveAndLock({ cwd: project.cwd }), /symlink/i);
    expect((err as { code?: string }).code).toBe("LOCAL_FILE_SYMLINK");
  });

  test("unknown suffix is rejected", async () => {
    const project = projectWith(["- path: ./ai/notes.md"]);
    writeText(join(project.cwd, "ai/notes.md"), "---\ndescription: Notes\n---\n# Notes\n");

    const err = await expectRejectsMatching(
      () => resolveAndLock({ cwd: project.cwd }),
      /unsupported single-file/i,
    );
    expect((err as { code?: string }).code).toBe("LOCAL_FILE_UNSUPPORTED");
  });

  test("missing frontmatter is rejected", async () => {
    const project = projectWith(["- path: ./ai/scout.agent.md"]);
    writeText(join(project.cwd, "ai/scout.agent.md"), "# Scout without frontmatter\n");

    const err = await expectRejectsMatching(
      () => resolveAndLock({ cwd: project.cwd }),
      /frontmatter/i,
    );
    expect((err as { code?: string }).code).toBe("LOCAL_FILE_INVALID_FRONTMATTER");
  });

  test("malformed frontmatter is rejected", async () => {
    const project = projectWith(["- path: ./ai/review.prompt.md"]);
    writeText(
      join(project.cwd, "ai/review.prompt.md"),
      "---\ndescription: [unclosed\n---\n# Review\n",
    );

    const err = await expectRejectsMatching(
      () => resolveAndLock({ cwd: project.cwd }),
      /frontmatter|YAML/i,
    );
    expect((err as { code?: string }).code).toBe("LOCAL_FILE_INVALID_FRONTMATTER");
  });
});
