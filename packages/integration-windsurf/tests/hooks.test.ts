/**
 * Hooks → merge .windsurf/hooks.json + scripts + .windsurf/bapm-hooks.json
 * sidecar; PascalCase events; reinstall replaces owned only
 *.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, loadWindsurfIntegration, readJson, writeJson } from "./helpers.ts";

describe("windsurf hooks", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("hook merges into hooks.json with PascalCase event and ownership sidecar", async () => {
    const project = createTempProject("bapm-windsurf-hooks-write-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".windsurf"), { recursive: true });

    mkdirSync(join(project.cwd, "pkg"), { recursive: true });
    writeFileSync(join(project.cwd, "pkg", "run.sh"), "#!/bin/sh\necho hi\n", "utf8");
    const hookSrc = join(project.cwd, "pkg", "session-start.json");
    writeJson(hookSrc, {
      hooks: {
        session_start: [{ type: "command", command: "./run.sh" }],
      },
    });

    const target = loadWindsurfIntegration();
    await target.materialize(
      [
        {
          name: "session-start",
          type: "hook",
          source: "dependency:demo-pkg",
          packageName: "demo-pkg",
          path: hookSrc,
        },
      ],
      { cwd: project.cwd, targetId: "windsurf", deployRoots: target.deployRoots },
    );

    const hooksPath = join(project.cwd, ".windsurf", "hooks.json");
    expect(existsSync(hooksPath)).toBe(true);
    const hookDoc = readJson(hooksPath);
    const hooks = hookDoc.hooks as Record<string, unknown> | undefined;
    expect(hooks).toBeTruthy();
    const eventKeys = Object.keys(hooks ?? {});
    expect(eventKeys.some((k) => k === "SessionStart")).toBe(true);
    expect(eventKeys.some((k) => k === "session_start" || k === "sessionStart")).toBe(false);
    expect(JSON.stringify(hookDoc)).not.toMatch(/_apm_source|bapm-owned/i);

    const scriptsDir = join(project.cwd, ".windsurf", "hooks", "session-start");
    expect(existsSync(scriptsDir)).toBe(true);
    expect(readdirSync(scriptsDir).length).toBeGreaterThan(0);

    const sidecar = join(project.cwd, ".windsurf", "bapm-hooks.json");
    expect(existsSync(sidecar)).toBe(true);
    const ownership = readJson(sidecar);
    expect(ownership).toHaveProperty("owned");
  });

  test("reinstall replaces owned hooks only and keeps unrelated user entries", async () => {
    const project = createTempProject("bapm-windsurf-hooks-reinstall-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".windsurf"), { recursive: true });
    writeJson(join(project.cwd, ".windsurf", "hooks.json"), {
      version: 1,
      hooks: {
        SessionStart: [{ type: "command", command: "./keep-user.sh" }],
      },
    });

    mkdirSync(join(project.cwd, "pkg"), { recursive: true });
    writeFileSync(join(project.cwd, "pkg", "v1.sh"), "#!/bin/sh\necho v1\n", "utf8");
    writeFileSync(join(project.cwd, "pkg", "v2.sh"), "#!/bin/sh\necho v2\n", "utf8");
    const hookV1 = join(project.cwd, "pkg", "hook-v1.json");
    writeJson(hookV1, {
      hooks: { sessionStart: [{ type: "command", command: "./v1.sh" }] },
    });
    const hookV2 = join(project.cwd, "pkg", "hook-v2.json");
    writeJson(hookV2, {
      hooks: { sessionStart: [{ type: "command", command: "./v2.sh" }] },
    });

    const target = loadWindsurfIntegration();
    const ctx = { cwd: project.cwd, targetId: "windsurf", deployRoots: target.deployRoots };
    await target.materialize(
      [
        {
          name: "owned-hook",
          type: "hook",
          source: "dependency:demo-pkg",
          packageName: "demo-pkg",
          path: hookV1,
        },
      ],
      ctx,
    );
    await target.materialize(
      [
        {
          name: "owned-hook",
          type: "hook",
          source: "dependency:demo-pkg",
          packageName: "demo-pkg",
          path: hookV2,
        },
      ],
      ctx,
    );

    const raw = readFileSync(join(project.cwd, ".windsurf", "hooks.json"), "utf8");
    expect(raw).toMatch(/keep-user\.sh/);
    expect(raw).toMatch(/v2\.sh/);
    expect(raw).not.toMatch(/v1\.sh/);
    expect(raw).not.toMatch(/_apm_source|bapm-owned/i);
  });
});
