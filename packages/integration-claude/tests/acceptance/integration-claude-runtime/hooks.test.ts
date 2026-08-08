/**
 * Hooks → .claude/settings.json merge + .claude/bapm-hooks.json ownership sidecar.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClaudeTarget, createTempDir, readJson, type TempDir } from "./helpers.ts";

describe("integration-claude-runtime · hooks", () => {
  let project: TempDir | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("merges hooks into settings.json, copies scripts, writes ownership sidecar", async () => {
    project = createTempDir("bapm-acc-claude-hooks-merge-");
    mkdirSync(join(project.cwd, ".claude"), { recursive: true });
    writeFileSync(
      join(project.cwd, ".claude", "settings.json"),
      `${JSON.stringify(
        {
          permissions: { allow: ["Bash"] },
          hooks: {
            SessionStart: [{ type: "command", command: "./keep-user.sh" }],
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const script = join(project.cwd, "pkg", "run.sh");
    mkdirSync(join(project.cwd, "pkg"), { recursive: true });
    writeFileSync(script, "#!/bin/sh\necho hi\n", "utf8");
    const hookSrc = join(project.cwd, "pkg", "session-start.json");
    writeFileSync(
      hookSrc,
      JSON.stringify({
        hooks: {
          SessionStart: [{ type: "command", command: "./run.sh" }],
        },
      }),
      "utf8",
    );

    const target = await createClaudeTarget();
    await target.materialize(
      [{ name: "session-start", type: "hook", source: "local", path: hookSrc }],
      { cwd: project.cwd, targetId: "claude", deployRoots: target.deployRoots },
    );

    const settingsPath = join(project.cwd, ".claude", "settings.json");
    expect(existsSync(settingsPath)).toBe(true);
    const settings = readJson(settingsPath) as {
      permissions?: unknown;
      hooks?: Record<string, Array<{ command?: string; type?: string; _apm_source?: unknown }>>;
    };
    expect(settings.permissions).toEqual({ allow: ["Bash"] });
    const session = settings.hooks?.SessionStart ?? [];
    expect(session.some((e) => e.command === "./keep-user.sh")).toBe(true);
    expect(
      session.some(
        (e) =>
          typeof e.command === "string" &&
          (e.command.includes(".claude/hooks/") || e.command.startsWith(".claude/")),
      ),
    ).toBe(true);
    expect(JSON.stringify(settings)).not.toMatch(/_apm_source/);

    expect(existsSync(join(project.cwd, ".claude", "bapm-hooks.json"))).toBe(true);
    const ownership = readJson(join(project.cwd, ".claude", "bapm-hooks.json"));
    expect(ownership).toHaveProperty("owned");
  });

  test("reinstall replaces owned hooks only and keeps non-owned handlers", async () => {
    project = createTempDir("bapm-acc-claude-hooks-reinstall-");
    mkdirSync(join(project.cwd, ".claude"), { recursive: true });
    writeFileSync(
      join(project.cwd, ".claude", "settings.json"),
      `${JSON.stringify(
        {
          hooks: {
            SessionStart: [{ type: "command", command: "./keep-user.sh" }],
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    mkdirSync(join(project.cwd, "pkg"), { recursive: true });
    writeFileSync(join(project.cwd, "pkg", "v1.sh"), "#!/bin/sh\necho v1\n", "utf8");
    writeFileSync(join(project.cwd, "pkg", "v2.sh"), "#!/bin/sh\necho v2\n", "utf8");
    const hookV1 = join(project.cwd, "pkg", "hook-v1.json");
    writeFileSync(
      hookV1,
      JSON.stringify({
        hooks: { SessionStart: [{ type: "command", command: "./v1.sh" }] },
      }),
      "utf8",
    );
    const hookV2 = join(project.cwd, "pkg", "hook-v2.json");
    writeFileSync(
      hookV2,
      JSON.stringify({
        hooks: { SessionStart: [{ type: "command", command: "./v2.sh" }] },
      }),
      "utf8",
    );

    const target = await createClaudeTarget();
    const ctx = { cwd: project.cwd, targetId: "claude", deployRoots: target.deployRoots };
    await target.materialize(
      [{ name: "owned-hook", type: "hook", source: "local", path: hookV1 }],
      ctx,
    );
    await target.materialize(
      [{ name: "owned-hook", type: "hook", source: "local", path: hookV2 }],
      ctx,
    );

    const settings = readJson(join(project.cwd, ".claude", "settings.json")) as {
      hooks?: Record<string, Array<{ command?: string }>>;
    };
    const session = settings.hooks?.SessionStart ?? [];
    expect(session.some((e) => e.command === "./keep-user.sh")).toBe(true);
    expect(session.some((e) => typeof e.command === "string" && e.command.includes("v2.sh"))).toBe(
      true,
    );
    expect(session.some((e) => typeof e.command === "string" && e.command.includes("v1.sh"))).toBe(
      false,
    );

    // Sidecar must not leak into native settings schema.
    const settingsRaw = readFileSync(join(project.cwd, ".claude", "settings.json"), "utf8");
    expect(settingsRaw).not.toMatch(/_apm_source|bapm-owned/i);
  });
});
