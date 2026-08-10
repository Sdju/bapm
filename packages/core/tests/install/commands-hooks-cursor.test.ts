/**
 * Cursor materialize for commands + hooks (install e2e).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCursorIntegration } from "@b-apm/integration-cursor";
import {
  createCursorRegistry,
  createTempProject,
  cursorCommandPrompt,
  cursorFlatHookJson,
  deployedPaths,
  getRunInstall,
  reportDiagnostics,
  writeApmPackage,
  writeText,
  type TempProject,
} from "./commands-hooks-helpers.ts";

describe("commands/hooks Cursor install materialize", () => {
  let project: TempProject;

  afterEach(() => {
    project?.cleanup();
  });

  test("command deploys to .cursor/commands/<name>.md and is inventoried", async () => {
    project = createTempProject();
    writeApmPackage(join(project.cwd, "cmd-dep"), "cmd-dep", {
      prompts: { "review-pr": cursorCommandPrompt("review-pr") },
    });
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: cursor-cmd\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm:\n    - path: ./cmd-dep\n`,
      "utf8",
    );
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });

    const registry = createCursorRegistry();
    await getRunInstall()({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
    });

    const dest = join(project.cwd, ".cursor", "commands", "review-pr.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toMatch(/description:\s*review-pr/i);
    expect(existsSync(join(project.cwd, ".cursor", "mcp.json"))).toBe(false);

    const lock = readFileSync(
      existsSync(join(project.cwd, "bapm.lock.yaml"))
        ? join(project.cwd, "bapm.lock.yaml")
        : join(project.cwd, "apm.lock.yaml"),
      "utf8",
    );
    expect(lock).toMatch(/\.cursor\/commands\/review-pr\.md/);
  });

  test("prompt-only frontmatter keys are dropped with inspectable diagnostic", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    const src = join(project.cwd, "src.prompt.md");
    writeText(src, cursorCommandPrompt("drop-keys", "author: alice\nmcp: some-server\n"));

    const report = await createCursorIntegration().materialize(
      [
        {
          name: "drop-keys",
          type: "command",
          source: "local",
          path: src,
        },
      ],
      {
        cwd: project.cwd,
        targetId: "cursor",
        deployRoots: [".agents/skills", ".cursor"],
      },
    );

    const dest = join(project.cwd, ".cursor", "commands", "drop-keys.md");
    expect(existsSync(dest)).toBe(true);
    const body = readFileSync(dest, "utf8");
    expect(body).not.toMatch(/^author:/m);
    expect(body).not.toMatch(/^mcp:/m);
    expect(body).toMatch(/^description:/m);
    const diags = reportDiagnostics(report);
    expect(diags.length).toBeGreaterThan(0);
    expect(JSON.stringify(diags)).toMatch(/author|mcp|frontmatter|drop/i);
    expect(deployedPaths(report)).toEqual(
      expect.arrayContaining([".cursor/commands/drop-keys.md"]),
    );
  });

  test("hook merges into .cursor/hooks.json with script under registered root", async () => {
    project = createTempProject();
    const dep = join(project.cwd, "hook-dep");
    writeApmPackage(dep, "hook-dep", {
      hooks: { "session-start": cursorFlatHookJson("./scripts/notify.sh") },
    });
    writeText(join(dep, "scripts", "notify.sh"), "#!/bin/sh\necho notify\n");
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: cursor-hook\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm:\n    - path: ./hook-dep\n`,
      "utf8",
    );
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeFileSync(
      join(project.cwd, ".cursor", "hooks.json"),
      JSON.stringify(
        {
          version: 1,
          hooks: {
            sessionStart: [{ command: "./user-owned.sh" }],
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const registry = createCursorRegistry();
    await getRunInstall()({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
    });

    const hooksPath = join(project.cwd, ".cursor", "hooks.json");
    expect(existsSync(hooksPath)).toBe(true);
    const hooksDoc = JSON.parse(readFileSync(hooksPath, "utf8")) as {
      hooks?: Record<string, Array<{ command?: string }>>;
    };
    const session = hooksDoc.hooks?.sessionStart ?? [];
    expect(session.some((e) => e.command === "./user-owned.sh")).toBe(true);
    expect(
      session.some((e) => typeof e.command === "string" && e.command.includes(".cursor/")),
    ).toBe(true);

    const underCursor = session
      .map((e) => e.command)
      .filter((c): c is string => typeof c === "string" && c.includes(".cursor/"));
    for (const cmd of underCursor) {
      const rel = cmd.replace(/^\.\//, "");
      expect(existsSync(join(project.cwd, rel))).toBe(true);
    }
    expect(existsSync(join(project.cwd, ".cursor", "mcp.json"))).toBe(false);
  });
});
