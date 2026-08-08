/**
 * Hooks merge into `.gemini/settings.json` with Gemini event remaps + ownership sidecar.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempProject,
  loadGeminiIntegration,
  readJson,
  writeJson,
  writePrimitiveFile,
} from "./helpers.ts";

describe("gemini hooks", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("hook merges into settings.json with BeforeTool remap and ownership sidecar", async () => {
    const project = createTempProject("bapm-gemini-hooks-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".gemini"), { recursive: true });
    writeJson(join(project.cwd, ".gemini", "settings.json"), {
      theme: "dark",
      mcpServers: { keep: { command: "keep" } },
    });

    const script = writePrimitiveFile(project.cwd, "pkg/hooks/run.sh", "#!/bin/sh\necho ok\n");
    const hookSrc = writePrimitiveFile(
      project.cwd,
      "pkg/hooks/check.json",
      JSON.stringify({
        hooks: {
          PreToolUse: [{ command: "./run.sh" }],
        },
      }),
    );

    const target = loadGeminiIntegration();
    await target.materialize(
      [{ name: "check", type: "hook", source: "local", path: hookSrc, packageName: "demo-pkg" }],
      { cwd: project.cwd, targetId: "gemini", deployRoots: target.deployRoots },
    );

    const settings = readJson(join(project.cwd, ".gemini", "settings.json"));
    expect(settings.theme).toBe("dark");
    expect((settings.mcpServers as Record<string, unknown>).keep).toBeTruthy();
    const hooks = settings.hooks as Record<string, unknown[]>;
    expect(Array.isArray(hooks.BeforeTool)).toBe(true);
    expect(hooks.PreToolUse).toBeUndefined();
    expect(existsSync(join(project.cwd, ".gemini", "bapm-hooks.json"))).toBe(true);
    expect(existsSync(script)).toBe(true);
  });

  test("reinstall replaces owned hooks and preserves user hooks", async () => {
    const project = createTempProject("bapm-gemini-hooks-reinstall-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".gemini"), { recursive: true });
    writeJson(join(project.cwd, ".gemini", "settings.json"), {
      hooks: {
        BeforeTool: [{ command: "./user-hook.sh", user: true }],
      },
    });

    const hookSrc = writePrimitiveFile(
      project.cwd,
      "pkg/hooks/owned.json",
      JSON.stringify({
        hooks: {
          PreToolUse: [{ command: "echo owned-v1" }],
        },
      }),
    );

    const target = loadGeminiIntegration();
    await target.materialize(
      [{ name: "owned", type: "hook", source: "local", path: hookSrc, packageName: "pkg" }],
      { cwd: project.cwd, targetId: "gemini", deployRoots: target.deployRoots },
    );

    writeFileSync(
      hookSrc,
      JSON.stringify({
        hooks: {
          PreToolUse: [{ command: "echo owned-v2" }],
        },
      }),
      "utf8",
    );

    await target.materialize(
      [{ name: "owned", type: "hook", source: "local", path: hookSrc, packageName: "pkg" }],
      { cwd: project.cwd, targetId: "gemini", deployRoots: target.deployRoots },
    );

    const settings = readJson(join(project.cwd, ".gemini", "settings.json"));
    const before = (settings.hooks as Record<string, Array<{ command?: string; user?: boolean }>>)
      .BeforeTool;
    expect(before.some((e) => e.user === true && e.command === "./user-hook.sh")).toBe(true);
    expect(before.some((e) => e.command === "echo owned-v2")).toBe(true);
    expect(before.some((e) => e.command === "echo owned-v1")).toBe(false);
  });
});
