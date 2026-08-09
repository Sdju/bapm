/**
 * stripOwnedHookCommands — filter only; no disk deletes
 * (integration-api-hook-helpers acceptance).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { api, tempCwd, writeText, type HookOwnershipSidecar } from "./helpers.ts";

const { stripOwnedHookCommands } = api;

describe("stripOwnedHookCommands", () => {
  test("owned commands removed; unrelated kept; non-array events unchanged", () => {
    const hooks: Record<string, unknown> = {
      SessionStart: [
        { type: "command", command: "./.cursor/hooks/owned/run.sh" },
        { type: "command", command: "./keep-user.sh" },
      ],
      PreToolUse: { not: "an-array" },
    };
    const ownership: HookOwnershipSidecar = {
      owned: {
        "demo/owned": {
          entries: [{ event: "SessionStart", command: "./.cursor/hooks/owned/run.sh" }],
          scripts: [".cursor/hooks/owned/run.sh"],
        },
      },
    };

    stripOwnedHookCommands(hooks, ownership);

    expect(hooks.SessionStart).toEqual([{ type: "command", command: "./keep-user.sh" }]);
    expect(hooks.PreToolUse).toEqual({ not: "an-array" });
  });

  test("empty ownership is a no-op", () => {
    const hooks = {
      SessionStart: [{ type: "command", command: "./keep.sh" }],
    };
    const before = structuredClone(hooks);
    stripOwnedHookCommands(hooks, { owned: {} });
    expect(hooks).toEqual(before);
  });

  test("does not delete script or hook files from disk", () => {
    const cwd = tempCwd("bapm-hook-strip-nodel-");
    const scriptRel = ".cursor/hooks/owned/run.sh";
    const scriptAbs = join(cwd, scriptRel);
    writeText(scriptAbs, "#!/bin/sh\necho hi\n");

    const hooks = {
      SessionStart: [{ type: "command", command: `./${scriptRel}` }],
    };
    const ownership: HookOwnershipSidecar = {
      owned: {
        "demo/owned": {
          entries: [{ event: "SessionStart", command: `./${scriptRel}` }],
          scripts: [scriptRel],
        },
      },
    };

    stripOwnedHookCommands(hooks, ownership);
    expect(hooks.SessionStart).toEqual([]);
    expect(existsSync(scriptAbs)).toBe(true);
  });
});
