/**
 * removeOwnedHookArtifacts — best-effort disk cleanup
 * (integration-api-hook-helpers acceptance).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { api, tempCwd, writeText, type HookOwnershipSidecar } from "./helpers.ts";

const { removeOwnedHookArtifacts } = api;

describe("removeOwnedHookArtifacts", () => {
  test("removes scripts, hookFile, and hookFiles listed in sidecar", () => {
    const cwd = tempCwd("bapm-hook-rm-artifacts-");
    const scriptA = ".cursor/hooks/a/run.sh";
    const scriptB = ".github/hooks/scripts/pkg/b.sh";
    const hookFile = ".github/hooks/pkg-b.json";
    const hookFiles = [".kiro/hooks/c.kiro.hook", ".kiro/hooks/d.kiro.hook"];

    for (const rel of [scriptA, scriptB, hookFile, ...hookFiles]) {
      writeText(join(cwd, rel), "x\n");
    }

    const ownership: HookOwnershipSidecar = {
      owned: {
        a: { scripts: [scriptA] },
        b: { hookFile, scripts: [scriptB] },
        c: { hookFiles, scripts: [] },
      },
    };

    const hooksSnapshot = { SessionStart: [{ command: "./keep.sh" }] };
    removeOwnedHookArtifacts(cwd, ownership);

    expect(existsSync(join(cwd, scriptA))).toBe(false);
    expect(existsSync(join(cwd, scriptB))).toBe(false);
    expect(existsSync(join(cwd, hookFile))).toBe(false);
    for (const rel of hookFiles) {
      expect(existsSync(join(cwd, rel))).toBe(false);
    }
    // Must not mutate hooks JSON objects passed by callers (helper takes only cwd+ownership).
    expect(hooksSnapshot.SessionStart).toEqual([{ command: "./keep.sh" }]);
  });

  test("missing paths are ignored without throwing", () => {
    const cwd = tempCwd("bapm-hook-rm-missing-");
    const ownership: HookOwnershipSidecar = {
      owned: {
        ghost: {
          scripts: [".cursor/hooks/missing.sh"],
          hookFile: ".github/hooks/missing.json",
          hookFiles: [".kiro/hooks/missing.kiro.hook"],
        },
      },
    };
    expect(() => removeOwnedHookArtifacts(cwd, ownership)).not.toThrow();
  });
});
