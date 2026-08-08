/**
 * Hooks → .agents/hooks.json (agy schema under bapm container) + scripts + sidecar.
 * (promoted from integration-antigravity-runtime acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, loadAntigravityIntegration, readJson, writeJson } from "./helpers.ts";

describe("antigravity hooks", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  function seedHookPackage(cwd: string, pkgName: string): string {
    const pkg = join(cwd, pkgName);
    mkdirSync(join(pkg, "hooks"), { recursive: true });
    writeFileSync(join(pkg, "hooks", "check.py"), "# check\n", "utf8");
    writeFileSync(join(pkg, "hooks", "done.py"), "# done\n", "utf8");
    const hookSrc = join(pkg, "hooks", "hooks.json");
    writeJson(hookSrc, {
      hooks: {
        PreToolUse: [
          {
            hooks: [
              {
                type: "command",
                command: "python hooks/check.py",
                timeoutSec: 15,
              },
            ],
          },
        ],
        Stop: [
          {
            type: "command",
            command: "python hooks/done.py",
            timeoutSec: 20,
          },
        ],
      },
    });
    return hookSrc;
  }

  test("merges into .agents/hooks.json with nested PreToolUse and flat Stop", async () => {
    const project = createTempProject("bapm-agy-hooks-");
    cleanup = project.cleanup;
    const hookSrc = seedHookPackage(project.cwd, "agyhooks");

    const target = loadAntigravityIntegration();
    await target.materialize(
      [
        {
          name: "agyhooks",
          type: "hook",
          source: "dependency:agyhooks",
          packageName: "agyhooks",
          path: hookSrc,
        },
      ],
      { cwd: project.cwd, targetId: "antigravity", deployRoots: target.deployRoots },
    );

    const hooksFile = join(project.cwd, ".agents", "hooks.json");
    expect(existsSync(hooksFile)).toBe(true);
    expect(existsSync(join(project.cwd, ".agents", "settings.json"))).toBe(false);

    const data = readJson(hooksFile);
    expect(data).toHaveProperty("bapm");
    const container = data.bapm as Record<string, unknown>;

    const pre = container.PreToolUse as Array<Record<string, unknown>>;
    expect(Array.isArray(pre) && pre.length >= 1).toBe(true);
    expect(pre[0]).toHaveProperty("hooks");
    const preHandlers = pre[0]!.hooks as Array<Record<string, unknown>>;
    expect(String(preHandlers[0]!.command)).toMatch(/\.agents\/hooks\//);
    expect(preHandlers[0]!.timeout).toBe(15);
    expect(preHandlers[0]!).not.toHaveProperty("timeoutSec");

    const stop = container.Stop as Array<Record<string, unknown>>;
    expect(Array.isArray(stop) && stop.length >= 1).toBe(true);
    expect(stop[0]).not.toHaveProperty("hooks");
    expect(String(stop[0]!.command)).toMatch(/\.agents\/hooks\//);
    expect(stop[0]!.timeout).toBe(20);

    expect(existsSync(join(project.cwd, ".agents", "bapm-hooks.json"))).toBe(true);
    const raw = JSON.stringify(data);
    expect(raw).not.toMatch(/_apm_source|_bapm_source/i);
  });

  test("preserves sibling user hook-name containers on reinstall", async () => {
    const project = createTempProject("bapm-agy-hooks-user-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".agents"), { recursive: true });
    writeJson(join(project.cwd, ".agents", "hooks.json"), {
      "my-user-hook": {
        Stop: [{ type: "command", command: "echo bye" }],
      },
    });
    const hookSrc = seedHookPackage(project.cwd, "agyhooks");

    const target = loadAntigravityIntegration();
    await target.materialize(
      [
        {
          name: "agyhooks",
          type: "hook",
          source: "dependency:agyhooks",
          packageName: "agyhooks",
          path: hookSrc,
        },
      ],
      { cwd: project.cwd, targetId: "antigravity", deployRoots: target.deployRoots },
    );

    const data = readJson(join(project.cwd, ".agents", "hooks.json"));
    const user = data["my-user-hook"] as { Stop: Array<{ command: string }> };
    expect(user.Stop[0]!.command).toBe("echo bye");
    expect(data).toHaveProperty("bapm");
  });
});
