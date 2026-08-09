/**
 * Simple copyHookScript contract
 * (integration-api-hook-helpers acceptance).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { api, tempCwd, writeText } from "./helpers.ts";

const { copyHookScript } = api;

describe("copyHookScript", () => {
  test("copies under deploy roots and rewrites command", () => {
    const cwd = tempCwd("bapm-hook-copy-ok-");
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
    const pkgDir = join(cwd, "pkg");
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, "bapm.yml"), "name: demo\n", "utf8");
    writeText(join(pkgDir, "run.sh"), "#!/bin/sh\necho hi\n");
    const hookFile = join(pkgDir, "hook.json");
    writeText(hookFile, '{"hooks":{}}\n');

    const destRel = ".cursor/hooks/demo/run.sh";
    const result = copyHookScript({
      cwd,
      deployRoots: [".cursor"],
      hookFile,
      command: "./run.sh",
      alreadyDeployedNeedle: ".cursor/",
      destRel,
      commandAsDotSlash: true,
    });

    expect(result.scriptRel).toBe(destRel);
    expect(result.commandRel).toBe(`./${destRel}`);
    expect(readFileSync(join(cwd, destRel), "utf8")).toBe("#!/bin/sh\necho hi\n");
  });

  test("already-deployed needle skips copy and invents no scriptRel", () => {
    const cwd = tempCwd("bapm-hook-copy-skip-");
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
    const hookFile = join(cwd, "pkg", "hook.json");
    writeText(hookFile, "{}\n");

    const result = copyHookScript({
      cwd,
      deployRoots: [".cursor"],
      hookFile,
      command: "./.cursor/hooks/demo/run.sh",
      alreadyDeployedNeedle: ".cursor/",
      destRel: ".cursor/hooks/demo/run.sh",
      commandAsDotSlash: true,
    });

    expect(result.scriptRel).toBeUndefined();
    expect(result.commandRel).toMatch(/\.cursor\/hooks\/demo\/run\.sh/);
    expect(existsSync(join(cwd, ".cursor", "hooks", "demo", "run.sh"))).toBe(false);
  });

  test("missing source keeps original command and writes nothing", () => {
    const cwd = tempCwd("bapm-hook-copy-missing-");
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
    const hookFile = join(cwd, "pkg", "hook.json");
    writeText(hookFile, "{}\n");

    const result = copyHookScript({
      cwd,
      deployRoots: [".cursor"],
      hookFile,
      command: "./no-such-script.sh",
      alreadyDeployedNeedle: ".cursor/",
      destRel: ".cursor/hooks/demo/no-such-script.sh",
    });

    expect(result).toEqual({ commandRel: "./no-such-script.sh" });
    expect(existsSync(join(cwd, ".cursor", "hooks"))).toBe(false);
  });

  test("refuses destination outside deploy roots", () => {
    const cwd = tempCwd("bapm-hook-copy-refuse-");
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
    const pkgDir = join(cwd, "pkg");
    writeText(join(pkgDir, "run.sh"), "ok\n");
    const hookFile = join(pkgDir, "hook.json");
    writeText(hookFile, "{}\n");

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
    expect(existsSync(join(cwd, "elsewhere", "run.sh"))).toBe(false);
  });
});
