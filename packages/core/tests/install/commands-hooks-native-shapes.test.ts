/**
 * Native hook shapes through install (Cursor flat, Codex nested, Claude nested
 * matcher groups with required handler type).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createIntegrationRegistry } from "@b-apm/integration-api";
import { createClaudeIntegration } from "../../../integration-claude/src/index.ts";
import { createCodexIntegration } from "../../../integration-codex/src/index.ts";
import { createCursorIntegration } from "../../../integration-cursor/src/index.ts";
import {
  createTempProject,
  getRunInstall,
  writeApmPackage,
  writeText,
  type TempProject,
} from "./commands-hooks-helpers.ts";

type HookHandler = { type?: string; command?: string; [key: string]: unknown };
type HookGroup = { matcher?: string; hooks?: HookHandler[]; [key: string]: unknown };
type HooksDoc = { hooks?: Record<string, Array<HookGroup | HookHandler>> };

function registryFor(target: ReturnType<typeof createCursorIntegration>) {
  const registry = createIntegrationRegistry();
  registry.register(target);
  return registry;
}

function readHooks(path: string): HooksDoc {
  return JSON.parse(readFileSync(path, "utf8")) as HooksDoc;
}

function groups(entries: Array<HookGroup | HookHandler> | undefined): HookGroup[] {
  return (entries ?? []).filter((entry): entry is HookGroup => Array.isArray(entry.hooks));
}

function flat(entries: Array<HookGroup | HookHandler> | undefined): HookHandler[] {
  return (entries ?? []).filter(
    (entry): entry is HookHandler => !Array.isArray((entry as HookGroup).hooks),
  );
}

describe("install · native hook shapes", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("Cursor keeps its documented flat hooks.json shape", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".cursor"), { recursive: true });
    writeFileSync(
      join(project.cwd, ".cursor", "hooks.json"),
      `${JSON.stringify(
        {
          version: 1,
          hooks: { sessionStart: [{ type: "command", command: "./user.sh" }] },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const dep = join(project.cwd, "cursor-hook-dep");
    writeApmPackage(dep, "cursor-hook-dep", {
      hooks: {
        "session-start": `${JSON.stringify(
          {
            version: 1,
            hooks: { sessionStart: [{ type: "command", command: "./notify.sh" }] },
          },
          null,
          2,
        )}\n`,
      },
    });
    writeText(join(dep, "notify.sh"), "#!/bin/sh\necho notify\n");
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: cursor-shape\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm:\n    - path: ./cursor-hook-dep\n`,
      "utf8",
    );

    const registry = registryFor(createCursorIntegration());
    await getRunInstall()({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
    });

    const session = readHooks(join(project.cwd, ".cursor", "hooks.json")).hooks?.sessionStart ?? [];
    expect(groups(session)).toEqual([]);
    expect(flat(session)).toContainEqual({ type: "command", command: "./user.sh" });
    expect(flat(session)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "command",
          command: "./.cursor/hooks/session-start/notify.sh",
        }),
      ]),
    );
  });

  test("Codex install writes nested matcher groups", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".codex"), { recursive: true });
    writeFileSync(
      join(project.cwd, ".codex", "hooks.json"),
      `${JSON.stringify(
        {
          version: 1,
          hooks: {
            SessionStart: [
              {
                matcher: "Read",
                hooks: [{ type: "command", command: "./user-keep.sh" }],
              },
            ],
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const dep = join(project.cwd, "codex-hook-dep");
    writeApmPackage(dep, "codex-hook-dep", {
      hooks: {
        "session-start": `${JSON.stringify(
          {
            hooks: {
              SessionStart: [{ type: "command", command: "./notify.sh" }],
              PreToolUse: [
                {
                  matcher: "Bash",
                  hooks: [{ type: "command", command: "./check.sh", timeout: 10 }],
                },
              ],
            },
          },
          null,
          2,
        )}\n`,
      },
    });
    writeText(join(dep, "notify.sh"), "#!/bin/sh\necho notify\n");
    writeText(join(dep, "check.sh"), "#!/bin/sh\nexit 0\n");
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: codex-shape\nversion: 0.0.1\ntarget: codex\ndependencies:\n  apm:\n    - path: ./codex-hook-dep\n`,
      "utf8",
    );

    const registry = registryFor(createCodexIntegration());
    await getRunInstall()({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
    });

    const hooks = readHooks(join(project.cwd, ".codex", "hooks.json")).hooks;
    const session = hooks?.SessionStart ?? [];
    expect(groups(session)).toContainEqual({
      matcher: "Read",
      hooks: [{ type: "command", command: "./user-keep.sh" }],
    });
    expect(flat(session)).toEqual([]);
    const bapmSession = groups(session).find((group) =>
      group.hooks?.some((handler) => handler.command?.includes(".codex/")),
    );
    expect(bapmSession?.matcher).toBeUndefined();
    expect(bapmSession?.hooks?.[0]).toMatchObject({
      type: "command",
      command: "./.codex/hooks/session-start/notify.sh",
    });

    const preTool = hooks?.PreToolUse ?? [];
    expect(preTool).toEqual([
      {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            command: "./.codex/hooks/session-start/check.sh",
            timeout: 10,
          },
        ],
      },
    ]);
  });

  test("Claude install writes matcher '*' groups and injects type command", async () => {
    project = createTempProject();
    mkdirSync(join(project.cwd, ".claude"), { recursive: true });
    writeFileSync(
      join(project.cwd, ".claude", "settings.json"),
      `${JSON.stringify(
        {
          permissions: { allow: ["Bash"] },
          hooks: {
            SessionStart: [
              {
                matcher: "Read",
                hooks: [{ type: "command", command: "./user-keep.sh" }],
              },
            ],
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const dep = join(project.cwd, "claude-hook-dep");
    writeApmPackage(dep, "claude-hook-dep", {
      hooks: {
        "session-start": `${JSON.stringify(
          {
            hooks: {
              SessionStart: [{ command: "./notify.sh" }],
              PreToolUse: [
                {
                  matcher: "Bash",
                  hooks: [{ type: "command", command: "./check.sh", timeout: 10 }],
                },
              ],
            },
          },
          null,
          2,
        )}\n`,
      },
    });
    writeText(join(dep, "notify.sh"), "#!/bin/sh\necho notify\n");
    writeText(join(dep, "check.sh"), "#!/bin/sh\nexit 0\n");
    writeFileSync(
      join(project.cwd, "bapm.yml"),
      `name: claude-shape\nversion: 0.0.1\ntarget: claude\ndependencies:\n  apm:\n    - path: ./claude-hook-dep\n`,
      "utf8",
    );

    const registry = registryFor(createClaudeIntegration());
    await getRunInstall()({
      cwd: project.cwd,
      frozen: false,
      integrationRegistry: registry,
      registry,
    });

    const settings = JSON.parse(
      readFileSync(join(project.cwd, ".claude", "settings.json"), "utf8"),
    ) as { permissions?: unknown; hooks?: Record<string, HookGroup[]> };
    expect(settings.permissions).toEqual({ allow: ["Bash"] });
    const session = settings.hooks?.SessionStart ?? [];
    expect(session).toContainEqual({
      matcher: "Read",
      hooks: [{ type: "command", command: "./user-keep.sh" }],
    });
    const bapmSession = session.find(
      (group) => group.matcher === "*" || group.hooks?.some((h) => h.command?.includes(".claude/")),
    );
    expect(bapmSession).toMatchObject({
      matcher: "*",
      hooks: [{ type: "command", command: "./.claude/hooks/session-start/notify.sh" }],
    });

    expect(settings.hooks?.PreToolUse).toEqual([
      {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            command: "./.claude/hooks/session-start/check.sh",
            timeout: 10,
          },
        ],
      },
    ]);
    expect(existsSync(join(project.cwd, ".claude", "bapm-hooks.json"))).toBe(true);
  });
});
