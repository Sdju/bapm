import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import {
  copyHookScript,
  readHookOwnershipSidecar,
  removeOwnedHookArtifacts,
  stripOwnedHookCommands,
  writeHookOwnershipSidecar,
  type HookOwnershipSidecar,
} from "../src/index.ts";

function tempCwd(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function writeText(abs: string, content: string): void {
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, "utf8");
}

describe("hook ownership sidecar", () => {
  test("missing / malformed → empty owned; write round-trips mixed fields", () => {
    const cwd = tempCwd("bapm-unit-hook-sidecar-");
    const path = join(cwd, ".cursor", "bapm-hooks.json");
    expect(readHookOwnershipSidecar(path)).toEqual({ owned: {} });

    writeText(path, "{bad");
    expect(readHookOwnershipSidecar(path)).toEqual({ owned: {} });

    writeText(path, JSON.stringify({ owned: "nope" }));
    expect(readHookOwnershipSidecar(path)).toEqual({ owned: {} });

    writeText(path, JSON.stringify({ something: 1 }));
    expect(readHookOwnershipSidecar(path)).toEqual({ owned: {} });

    const doc: HookOwnershipSidecar = {
      owned: {
        a: {
          entries: [{ event: "SessionStart", command: "./.cursor/hooks/a.sh" }],
          scripts: [".cursor/hooks/a.sh"],
        },
        b: { hookFile: ".github/hooks/b.json", scripts: [".github/hooks/b.sh"] },
        c: { hookFiles: [".kiro/hooks/c.json"], scripts: [".kiro/hooks/c.sh"] },
      },
    };
    writeHookOwnershipSidecar(path, doc);
    expect(readFileSync(path, "utf8")).toBe(`${JSON.stringify({ owned: doc.owned }, null, 2)}\n`);
    const round = readHookOwnershipSidecar(path);
    expect(round.owned.a?.entries).toEqual(doc.owned.a?.entries);
    expect(round.owned.b?.hookFile).toBe(".github/hooks/b.json");
    expect(round.owned.c?.hookFiles).toEqual([".kiro/hooks/c.json"]);
  });
});

describe("stripOwnedHookCommands", () => {
  test("removes owned commands; empty ownership is a no-op; no disk deletes", () => {
    const hooks: Record<string, unknown> = {
      SessionStart: [{ command: "./owned.sh" }, { command: "./keep.sh" }],
      meta: { not: "array" },
    };
    stripOwnedHookCommands(hooks, {
      owned: { x: { entries: [{ event: "SessionStart", command: "./owned.sh" }] } },
    });
    expect(hooks.SessionStart).toEqual([{ command: "./keep.sh" }]);
    expect(hooks.meta).toEqual({ not: "array" });

    const noop = { SessionStart: [{ command: "./keep.sh" }] };
    const before = structuredClone(noop);
    stripOwnedHookCommands(noop, { owned: {} });
    expect(noop).toEqual(before);

    const cwd = tempCwd("bapm-unit-hook-strip-nodel-");
    const scriptRel = ".cursor/hooks/owned/run.sh";
    const scriptAbs = join(cwd, scriptRel);
    writeText(scriptAbs, "#!/bin/sh\necho hi\n");
    const diskHooks = {
      SessionStart: [{ command: `./${scriptRel}` }],
    };
    stripOwnedHookCommands(diskHooks, {
      owned: {
        owned: {
          entries: [{ event: "SessionStart", command: `./${scriptRel}` }],
          scripts: [scriptRel],
        },
      },
    });
    expect(diskHooks.SessionStart).toEqual([]);
    expect(existsSync(scriptAbs)).toBe(true);
  });
});

describe("removeOwnedHookArtifacts", () => {
  test("deletes listed paths; missing paths ignored", () => {
    const cwd = tempCwd("bapm-unit-hook-rm-");
    const script = ".cursor/hooks/a.sh";
    const hookFile = ".github/hooks/b.json";
    const hookFiles = [".kiro/hooks/c.json"];
    for (const rel of [script, hookFile, ...hookFiles]) writeText(join(cwd, rel), "x\n");

    removeOwnedHookArtifacts(cwd, {
      owned: {
        a: { scripts: [script] },
        b: { hookFile, scripts: [] },
        c: { hookFiles },
      },
    });
    expect(existsSync(join(cwd, script))).toBe(false);
    expect(existsSync(join(cwd, hookFile))).toBe(false);
    expect(existsSync(join(cwd, hookFiles[0]!))).toBe(false);

    expect(() =>
      removeOwnedHookArtifacts(cwd, {
        owned: { ghost: { scripts: [".missing.sh"], hookFile: ".missing.json" } },
      }),
    ).not.toThrow();
  });
});

describe("copyHookScript", () => {
  test("copy + rewrite; needle skip; missing source; deploy-root refusal", () => {
    const cwd = tempCwd("bapm-unit-hook-copy-");
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
    const pkgDir = join(cwd, "pkg");
    writeText(join(pkgDir, "bapm.yml"), "name: demo\n");
    writeText(join(pkgDir, "run.sh"), "#!/bin/sh\necho hi\n");
    const hookFile = join(pkgDir, "hook.json");
    writeText(hookFile, "{}\n");

    const destRel = ".cursor/hooks/demo/run.sh";
    const ok = copyHookScript({
      cwd,
      deployRoots: [".cursor"],
      hookFile,
      command: "./run.sh",
      alreadyDeployedNeedle: ".cursor/",
      destRel,
      commandAsDotSlash: true,
    });
    expect(ok).toEqual({ commandRel: `./${destRel}`, scriptRel: destRel });
    expect(readFileSync(join(cwd, destRel), "utf8")).toBe("#!/bin/sh\necho hi\n");

    const skip = copyHookScript({
      cwd,
      deployRoots: [".cursor"],
      hookFile,
      command: "./.cursor/hooks/demo/run.sh",
      alreadyDeployedNeedle: ".cursor/",
      destRel,
      commandAsDotSlash: true,
    });
    expect(skip.scriptRel).toBeUndefined();
    expect(skip.commandRel).toMatch(/\.cursor\/hooks\/demo\/run\.sh/);

    const missing = copyHookScript({
      cwd,
      deployRoots: [".cursor"],
      hookFile,
      command: "./nope.sh",
      alreadyDeployedNeedle: ".cursor/",
      destRel: ".cursor/hooks/demo/nope.sh",
    });
    expect(missing).toEqual({ commandRel: "./nope.sh" });

    expect(() =>
      copyHookScript({
        cwd,
        deployRoots: [".cursor"],
        hookFile,
        command: "./run.sh",
        alreadyDeployedNeedle: ".cursor/",
        destRel: "elsewhere/run.sh",
      }),
    ).toThrow(/deploy roots/);
  });
});
