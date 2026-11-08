/**
 * Hooks → .claude/settings.json merge + .claude/bapm-hooks.json ownership sidecar;
 * Claude native nested matcher groups with required `type: "command"`
 * (promoted from integration-claude-runtime acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClaudeIntegration } from "../src/createClaudeIntegration.ts";

type HookHandler = { type?: string; command?: string; [key: string]: unknown };
type HookGroup = { matcher?: string; hooks?: HookHandler[]; [key: string]: unknown };
type SettingsDoc = {
  permissions?: unknown;
  hooks?: Record<string, HookGroup[]>;
  [key: string]: unknown;
};

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function readSettings(path: string): SettingsDoc {
  return readJson(path) as SettingsDoc;
}

function bapmGroups(groups: HookGroup[] | undefined): HookGroup[] {
  return (groups ?? []).filter((group) =>
    (group.hooks ?? []).some(
      (handler) => typeof handler.command === "string" && handler.command.includes(".claude/"),
    ),
  );
}

function seedHook(root: string, entries: unknown[] = [{ type: "command", command: "./run.sh" }]) {
  const hookSrc = join(root, "pkg", "session-start.json");
  writeFileSync(hookSrc, JSON.stringify({ hooks: { SessionStart: entries } }), "utf8");
  return hookSrc;
}

describe("claude hooks", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("renders flat portable hooks as matcher '*' groups and preserves foreign groups", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-hooks-merge-"));
    mkdirSync(join(cwd, ".claude"), { recursive: true });
    writeFileSync(
      join(cwd, ".claude", "settings.json"),
      `${JSON.stringify(
        {
          permissions: { allow: ["Bash"] },
          hooks: {
            SessionStart: [
              {
                matcher: "Read",
                hooks: [{ type: "command", command: "./keep-user.sh", timeout: 3 }],
              },
            ],
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    mkdirSync(join(cwd, "pkg"), { recursive: true });
    writeFileSync(join(cwd, "pkg", "run.sh"), "#!/bin/sh\necho hi\n", "utf8");
    const hookSrc = seedHook(cwd);

    const target = createClaudeIntegration();
    await target.materialize(
      [{ name: "session-start", type: "hook", source: "local", path: hookSrc }],
      { cwd, targetId: "claude", deployRoots: target.deployRoots },
    );

    const settingsPath = join(cwd, ".claude", "settings.json");
    expect(existsSync(settingsPath)).toBe(true);
    const settings = readSettings(settingsPath);
    expect(settings.permissions).toEqual({ allow: ["Bash"] });
    const session = settings.hooks?.SessionStart ?? [];
    expect(session).toContainEqual({
      matcher: "Read",
      hooks: [{ type: "command", command: "./keep-user.sh", timeout: 3 }],
    });

    const owned = bapmGroups(session);
    expect(owned).toHaveLength(1);
    expect(owned[0]?.matcher).toBe("*");
    expect(owned[0]?.hooks).toEqual([
      { type: "command", command: "./.claude/hooks/session-start/run.sh" },
    ]);
    expect(JSON.stringify(settings)).not.toMatch(/_apm_source/);

    expect(existsSync(join(cwd, ".claude", "bapm-hooks.json"))).toBe(true);
    const ownership = readJson(join(cwd, ".claude", "bapm-hooks.json")) as {
      owned?: Record<
        string,
        { entries?: Array<{ event: string; command: string }>; scripts?: string[] }
      >;
    };
    expect(ownership.owned?.["session-start"]?.entries).toEqual([
      { event: "SessionStart", command: "./.claude/hooks/session-start/run.sh" },
    ]);
    expect(ownership.owned?.["session-start"]?.scripts).toEqual([
      ".claude/hooks/session-start/run.sh",
    ]);
  });

  test("injects type command into flat untyped entries only", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-hooks-untyped-"));
    mkdirSync(join(cwd, ".claude"), { recursive: true });

    mkdirSync(join(cwd, "pkg"), { recursive: true });
    writeFileSync(join(cwd, "pkg", "run.sh"), "#!/bin/sh\necho hi\n", "utf8");
    const hookSrc = seedHook(cwd, [{ command: "./run.sh" }]);

    const target = createClaudeIntegration();
    await target.materialize(
      [{ name: "session-start", type: "hook", source: "local", path: hookSrc }],
      { cwd, targetId: "claude", deployRoots: target.deployRoots },
    );

    const settings = readSettings(join(cwd, ".claude", "settings.json"));
    const owned = bapmGroups(settings.hooks?.SessionStart);
    expect(owned).toHaveLength(1);
    expect(owned[0]?.matcher).toBe("*");
    expect(owned[0]?.hooks?.[0]).toMatchObject({
      type: "command",
      command: "./.claude/hooks/session-start/run.sh",
    });
  });

  test("preserves nested source matchers and explicitly typed handlers", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-hooks-nested-source-"));
    mkdirSync(join(cwd, ".claude"), { recursive: true });

    mkdirSync(join(cwd, "pkg"), { recursive: true });
    writeFileSync(join(cwd, "pkg", "check.sh"), "#!/bin/sh\nexit 0\n", "utf8");
    const hookSrc = join(cwd, "pkg", "pre-tool.json");
    writeFileSync(
      hookSrc,
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [
                {
                  type: "command",
                  command: "./check.sh",
                  timeout: 10,
                  env: { BAPM_CHECK: "1" },
                },
              ],
            },
          ],
        },
      }),
      "utf8",
    );

    const target = createClaudeIntegration();
    await target.materialize([{ name: "pre-tool", type: "hook", source: "local", path: hookSrc }], {
      cwd,
      targetId: "claude",
      deployRoots: target.deployRoots,
    });

    const settings = readSettings(join(cwd, ".claude", "settings.json"));
    const preTool = settings.hooks?.PreToolUse ?? [];
    expect(preTool).toHaveLength(1);
    expect(preTool[0]?.matcher).toBe("Bash");
    expect(preTool[0]?.hooks?.[0]).toMatchObject({
      type: "command",
      command: "./.claude/hooks/pre-tool/check.sh",
      timeout: 10,
      env: { BAPM_CHECK: "1" },
    });
  });

  test("reinstall replaces owned nested handlers only and keeps non-owned handlers", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-hooks-reinstall-"));
    mkdirSync(join(cwd, ".claude"), { recursive: true });
    writeFileSync(
      join(cwd, ".claude", "settings.json"),
      `${JSON.stringify(
        {
          hooks: {
            SessionStart: [
              {
                matcher: "Read",
                hooks: [{ type: "command", command: "./keep-user.sh" }],
              },
            ],
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    mkdirSync(join(cwd, "pkg"), { recursive: true });
    writeFileSync(join(cwd, "pkg", "v1.sh"), "#!/bin/sh\necho v1\n", "utf8");
    writeFileSync(join(cwd, "pkg", "v2.sh"), "#!/bin/sh\necho v2\n", "utf8");
    const hookV1 = join(cwd, "pkg", "hook-v1.json");
    writeFileSync(
      hookV1,
      JSON.stringify({
        hooks: { SessionStart: [{ type: "command", command: "./v1.sh" }] },
      }),
      "utf8",
    );
    const hookV2 = join(cwd, "pkg", "hook-v2.json");
    writeFileSync(
      hookV2,
      JSON.stringify({
        hooks: { SessionStart: [{ type: "command", command: "./v2.sh" }] },
      }),
      "utf8",
    );

    const target = createClaudeIntegration();
    const ctx = { cwd, targetId: "claude", deployRoots: target.deployRoots };
    await target.materialize(
      [{ name: "owned-hook", type: "hook", source: "local", path: hookV1 }],
      ctx,
    );
    await target.materialize(
      [{ name: "owned-hook", type: "hook", source: "local", path: hookV2 }],
      ctx,
    );

    const settings = readSettings(join(cwd, ".claude", "settings.json"));
    const session = settings.hooks?.SessionStart ?? [];
    expect(session).toContainEqual({
      matcher: "Read",
      hooks: [{ type: "command", command: "./keep-user.sh" }],
    });
    const owned = bapmGroups(session);
    expect(owned).toHaveLength(1);
    expect(owned[0]?.matcher).toBe("*");
    expect(owned[0]?.hooks?.[0]?.command).toContain("v2.sh");
    expect(JSON.stringify(settings)).not.toContain("v1.sh");

    // Sidecar must not leak into native settings schema.
    const settingsRaw = readFileSync(join(cwd, ".claude", "settings.json"), "utf8");
    expect(settingsRaw).not.toMatch(/_apm_source|bapm-owned/i);
  });

  test("removes legacy flat bapm handlers listed in the ownership sidecar", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-claude-hooks-legacy-flat-"));
    mkdirSync(join(cwd, ".claude", "hooks", "owned-hook"), { recursive: true });
    writeFileSync(
      join(cwd, ".claude", "settings.json"),
      `${JSON.stringify(
        {
          hooks: {
            SessionStart: [
              { type: "command", command: "./.claude/hooks/owned-hook/v1.sh" },
              { type: "command", command: "./keep-user.sh" },
            ],
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    writeFileSync(
      join(cwd, ".claude", "bapm-hooks.json"),
      `${JSON.stringify(
        {
          owned: {
            "owned-hook": {
              entries: [{ event: "SessionStart", command: "./.claude/hooks/owned-hook/v1.sh" }],
              scripts: [".claude/hooks/owned-hook/v1.sh"],
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    mkdirSync(join(cwd, "pkg"), { recursive: true });
    writeFileSync(join(cwd, "pkg", "v2.sh"), "#!/bin/sh\necho v2\n", "utf8");
    const hookV2 = join(cwd, "pkg", "hook-v2.json");
    writeFileSync(
      hookV2,
      JSON.stringify({
        hooks: { SessionStart: [{ type: "command", command: "./v2.sh" }] },
      }),
      "utf8",
    );

    const target = createClaudeIntegration();
    await target.materialize(
      [{ name: "owned-hook", type: "hook", source: "local", path: hookV2 }],
      { cwd, targetId: "claude", deployRoots: target.deployRoots },
    );

    const settings = readSettings(join(cwd, ".claude", "settings.json"));
    const session = settings.hooks?.SessionStart ?? [];
    expect(session).toContainEqual({ type: "command", command: "./keep-user.sh" });
    expect(JSON.stringify(settings)).not.toContain("v1.sh");
    expect(bapmGroups(session)).toHaveLength(1);
  });
});
