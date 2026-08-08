/**
 * Hooks → per-file .github/hooks/<pkg>-<stem>.json + scripts + .github/bapm-hooks.json
 * sidecar; camelCase events; reinstall replaces owned only
 * (integration-copilot-runtime acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, loadCopilotIntegration, readJson, writeJson } from "./helpers.ts";

describe("copilot hooks", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("hook becomes per-file JSON with camelCase event and ownership sidecar", async () => {
    const project = createTempProject("bapm-copilot-hooks-write-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".github"), { recursive: true });

    mkdirSync(join(project.cwd, "pkg"), { recursive: true });
    writeFileSync(join(project.cwd, "pkg", "run.sh"), "#!/bin/sh\necho hi\n", "utf8");
    const hookSrc = join(project.cwd, "pkg", "session-start.json");
    writeJson(hookSrc, {
      hooks: {
        session_start: [{ type: "command", command: "./run.sh" }],
      },
    });

    const target = loadCopilotIntegration();
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
      { cwd: project.cwd, targetId: "copilot", deployRoots: target.deployRoots },
    );

    const hookFile = join(project.cwd, ".github", "hooks", "demo-pkg-session-start.json");
    expect(existsSync(hookFile)).toBe(true);
    const hookDoc = readJson(hookFile);
    const hooks = hookDoc.hooks as Record<string, unknown> | undefined;
    expect(hooks).toBeTruthy();
    const eventKeys = Object.keys(hooks ?? {});
    expect(eventKeys.some((k) => k === "sessionStart")).toBe(true);
    expect(eventKeys.some((k) => k === "session_start" || k === "SessionStart")).toBe(false);
    expect(JSON.stringify(hookDoc)).not.toMatch(/_apm_source|bapm-owned/i);

    const scriptsDir = join(project.cwd, ".github", "hooks", "scripts", "demo-pkg");
    expect(existsSync(scriptsDir)).toBe(true);
    expect(readdirSync(scriptsDir).length).toBeGreaterThan(0);

    const sidecar = join(project.cwd, ".github", "bapm-hooks.json");
    expect(existsSync(sidecar)).toBe(true);
    const ownership = readJson(sidecar);
    expect(ownership).toHaveProperty("owned");
  });

  test("reinstall replaces owned hooks only and keeps unrelated user hook files", async () => {
    const project = createTempProject("bapm-copilot-hooks-reinstall-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".github", "hooks"), { recursive: true });
    writeJson(join(project.cwd, ".github", "hooks", "user-keep.json"), {
      hooks: { sessionStart: [{ type: "command", command: "./keep-user.sh" }] },
    });

    mkdirSync(join(project.cwd, "pkg"), { recursive: true });
    writeFileSync(join(project.cwd, "pkg", "v1.sh"), "#!/bin/sh\necho v1\n", "utf8");
    writeFileSync(join(project.cwd, "pkg", "v2.sh"), "#!/bin/sh\necho v2\n", "utf8");
    const hookV1 = join(project.cwd, "pkg", "hook-v1.json");
    writeJson(hookV1, {
      hooks: { SessionStart: [{ type: "command", command: "./v1.sh" }] },
    });
    const hookV2 = join(project.cwd, "pkg", "hook-v2.json");
    writeJson(hookV2, {
      hooks: { SessionStart: [{ type: "command", command: "./v2.sh" }] },
    });

    const target = loadCopilotIntegration();
    const ctx = { cwd: project.cwd, targetId: "copilot", deployRoots: target.deployRoots };
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

    expect(existsSync(join(project.cwd, ".github", "hooks", "user-keep.json"))).toBe(true);
    const ownedPath = join(project.cwd, ".github", "hooks", "demo-pkg-owned-hook.json");
    expect(existsSync(ownedPath)).toBe(true);
    const ownedRaw = readFileSync(ownedPath, "utf8");
    expect(ownedRaw).toMatch(/v2\.sh/);
    expect(ownedRaw).not.toMatch(/v1\.sh/);
    expect(ownedRaw).not.toMatch(/_apm_source|bapm-owned/i);
  });
});
