/**
 * Hooks → `.codex/hooks.json` merge + `.codex/bapm-hooks.json` ownership sidecar;
 * Codex native nested matcher groups; forced target mkdir-on-write
 * (promoted from integration-codex-runtime acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCodexIntegration } from "../src/createCodexIntegration.ts";

type HookHandler = { type?: string; command?: string; [key: string]: unknown };
type HookGroup = { matcher?: string; hooks?: HookHandler[]; [key: string]: unknown };
type HooksDoc = {
  version?: number;
  meta?: unknown;
  hooks?: Record<string, HookGroup[]>;
};

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function readHooks(path: string): HooksDoc {
  return readJson(path) as HooksDoc;
}

function bapmGroups(groups: HookGroup[] | undefined): HookGroup[] {
  return (groups ?? []).filter((group) =>
    (group.hooks ?? []).some(
      (handler) => typeof handler.command === "string" && handler.command.includes(".codex/"),
    ),
  );
}

function seedHook(root: string): string {
  const hookSrc = join(root, "pkg", "session-start.json");
  writeFileSync(
    hookSrc,
    JSON.stringify({
      hooks: {
        SessionStart: [{ type: "command", command: "./run.sh" }],
      },
    }),
    "utf8",
  );
  return hookSrc;
}

describe("codex hooks", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("renders flat portable hooks as nested groups and preserves foreign handlers", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-hooks-merge-"));
    mkdirSync(join(cwd, ".codex"), { recursive: true });
    writeFileSync(
      join(cwd, ".codex", "hooks.json"),
      `${JSON.stringify(
        {
          version: 1,
          meta: "keep-me",
          hooks: {
            SessionStart: [
              {
                matcher: "Bash",
                hooks: [{ type: "command", command: "./keep-user.sh", timeout: 5 }],
              },
              { type: "command", command: "./legacy-flat-user.sh" },
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

    const target = createCodexIntegration();
    await target.materialize(
      [{ name: "session-start", type: "hook", source: "local", path: hookSrc }],
      { cwd, targetId: "codex", deployRoots: target.deployRoots },
    );

    const hooksPath = join(cwd, ".codex", "hooks.json");
    expect(existsSync(hooksPath)).toBe(true);
    const hooksDoc = readHooks(hooksPath);
    expect(hooksDoc.meta).toBe("keep-me");
    const session = hooksDoc.hooks?.SessionStart ?? [];
    expect(session).toContainEqual({
      matcher: "Bash",
      hooks: [{ type: "command", command: "./keep-user.sh", timeout: 5 }],
    });
    expect(session).toContainEqual({ type: "command", command: "./legacy-flat-user.sh" });

    const owned = bapmGroups(session);
    expect(owned).toHaveLength(1);
    expect(owned[0]?.matcher).toBeUndefined();
    expect(owned[0]?.hooks).toHaveLength(1);
    expect(owned[0]?.hooks?.[0]).toMatchObject({
      type: "command",
      command: "./.codex/hooks/session-start/run.sh",
    });
    expect(JSON.stringify(hooksDoc)).not.toMatch(/_apm_source|bapm-owned/i);

    const scriptRel = ".codex/hooks/session-start/run.sh";
    expect(existsSync(join(cwd, scriptRel))).toBe(true);

    expect(existsSync(join(cwd, ".codex", "bapm-hooks.json"))).toBe(true);
    const ownership = readJson(join(cwd, ".codex", "bapm-hooks.json")) as {
      owned?: Record<
        string,
        { entries?: Array<{ event: string; command: string }>; scripts?: string[] }
      >;
    };
    expect(ownership.owned?.["session-start"]?.entries).toEqual([
      { event: "SessionStart", command: `./${scriptRel}` },
    ]);
    expect(ownership.owned?.["session-start"]?.scripts).toEqual([scriptRel]);
  });

  test("preserves nested source group matchers, handler fields, and PascalCase events", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-hooks-nested-source-"));
    mkdirSync(join(cwd, ".codex"), { recursive: true });

    mkdirSync(join(cwd, "pkg"), { recursive: true });
    writeFileSync(join(cwd, "pkg", "check.sh"), "#!/bin/sh\nexit 0\n", "utf8");
    const hookSrc = join(cwd, "pkg", "pre-tool.json");
    writeFileSync(
      hookSrc,
      JSON.stringify({
        hooks: {
          "pre-tool-use": [
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

    const target = createCodexIntegration();
    await target.materialize([{ name: "pre-tool", type: "hook", source: "local", path: hookSrc }], {
      cwd,
      targetId: "codex",
      deployRoots: target.deployRoots,
    });

    const hooksDoc = readHooks(join(cwd, ".codex", "hooks.json"));
    const preTool = hooksDoc.hooks?.PreToolUse ?? [];
    expect(preTool).toHaveLength(1);
    expect(preTool[0]?.matcher).toBe("Bash");
    expect(preTool[0]?.hooks?.[0]).toMatchObject({
      type: "command",
      command: "./.codex/hooks/pre-tool/check.sh",
      timeout: 10,
      env: { BAPM_CHECK: "1" },
    });
  });

  test("reinstall replaces owned nested handlers only and keeps non-owned handlers", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-hooks-reinstall-"));
    mkdirSync(join(cwd, ".codex"), { recursive: true });
    writeFileSync(
      join(cwd, ".codex", "hooks.json"),
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

    const target = createCodexIntegration();
    const ctx = { cwd, targetId: "codex", deployRoots: target.deployRoots };
    await target.materialize(
      [{ name: "owned-hook", type: "hook", source: "local", path: hookV1 }],
      ctx,
    );
    await target.materialize(
      [{ name: "owned-hook", type: "hook", source: "local", path: hookV2 }],
      ctx,
    );

    const hooksDoc = readHooks(join(cwd, ".codex", "hooks.json"));
    const session = hooksDoc.hooks?.SessionStart ?? [];
    expect(session).toContainEqual({
      matcher: "Read",
      hooks: [{ type: "command", command: "./keep-user.sh" }],
    });
    const owned = bapmGroups(session);
    expect(owned).toHaveLength(1);
    expect(owned[0]?.hooks?.[0]?.command).toContain("v2.sh");
    expect(JSON.stringify(hooksDoc)).not.toContain("v1.sh");

    const ownership = readJson(join(cwd, ".codex", "bapm-hooks.json")) as {
      owned?: Record<string, { entries?: Array<{ command: string }> }>;
    };
    expect(ownership.owned?.["owned-hook"]?.entries).toEqual([
      { event: "SessionStart", command: "./.codex/hooks/owned-hook/v2.sh" },
    ]);
  });

  test("removes legacy flat bapm handlers listed in the ownership sidecar", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-hooks-legacy-flat-"));
    mkdirSync(join(cwd, ".codex", "hooks", "owned-hook"), { recursive: true });
    writeFileSync(
      join(cwd, ".codex", "hooks.json"),
      `${JSON.stringify(
        {
          version: 1,
          hooks: {
            SessionStart: [
              { type: "command", command: "./.codex/hooks/owned-hook/v1.sh" },
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
      join(cwd, ".codex", "bapm-hooks.json"),
      `${JSON.stringify(
        {
          owned: {
            "owned-hook": {
              entries: [{ event: "SessionStart", command: "./.codex/hooks/owned-hook/v1.sh" }],
              scripts: [".codex/hooks/owned-hook/v1.sh"],
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

    const target = createCodexIntegration();
    await target.materialize(
      [{ name: "owned-hook", type: "hook", source: "local", path: hookV2 }],
      { cwd, targetId: "codex", deployRoots: target.deployRoots },
    );

    const hooksDoc = readHooks(join(cwd, ".codex", "hooks.json"));
    const session = hooksDoc.hooks?.SessionStart ?? [];
    expect(session).toContainEqual({ type: "command", command: "./keep-user.sh" });
    expect(JSON.stringify(hooksDoc)).not.toContain("v1.sh");
    expect(bapmGroups(session)).toHaveLength(1);
  });

  test("forced codex creates .codex roots for hooks when absent", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-codex-hooks-force-mkdir-"));
    expect(existsSync(join(cwd, ".codex"))).toBe(false);

    mkdirSync(join(cwd, "pkg"), { recursive: true });
    writeFileSync(join(cwd, "pkg", "run.sh"), "#!/bin/sh\necho hi\n", "utf8");
    const hookSrc = seedHook(cwd);

    const target = createCodexIntegration();
    await target.materialize(
      [{ name: "session-start", type: "hook", source: "local", path: hookSrc }],
      { cwd, targetId: "codex", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(cwd, ".codex", "hooks.json"))).toBe(true);
    expect(existsSync(join(cwd, ".codex", "bapm-hooks.json"))).toBe(true);
    expect(
      bapmGroups(readHooks(join(cwd, ".codex", "hooks.json")).hooks?.SessionStart),
    ).toHaveLength(1);
  });
});
