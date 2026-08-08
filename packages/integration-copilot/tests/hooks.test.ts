import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCopilotIntegration, toCamelCaseEvent } from "../src/index.ts";

describe("createCopilotIntegration hooks", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  function temp(): string {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-copilot-unit-hooks-"));
    cleanup = () => rmSync(cwd, { recursive: true, force: true });
    return cwd;
  }

  test("toCamelCaseEvent normalizes snake and Pascal", () => {
    expect(toCamelCaseEvent("session_start")).toBe("sessionStart");
    expect(toCamelCaseEvent("SessionStart")).toBe("sessionStart");
  });

  test("sidecar ownership enables idempotent reinstall", async () => {
    const cwd = temp();
    mkdirSync(join(cwd, ".github", "hooks"), { recursive: true });
    writeFileSync(
      join(cwd, ".github", "hooks", "user-keep.json"),
      `${JSON.stringify({ hooks: { sessionStart: [{ command: "./keep.sh" }] } }, null, 2)}\n`,
      "utf8",
    );

    mkdirSync(join(cwd, "pkg"), { recursive: true });
    writeFileSync(join(cwd, "pkg", "v1.sh"), "echo v1\n", "utf8");
    writeFileSync(join(cwd, "pkg", "v2.sh"), "echo v2\n", "utf8");
    writeFileSync(
      join(cwd, "pkg", "hook-v1.json"),
      `${JSON.stringify({ hooks: { session_start: [{ type: "command", command: "./v1.sh" }] } }, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      join(cwd, "pkg", "hook-v2.json"),
      `${JSON.stringify({ hooks: { SessionStart: [{ type: "command", command: "./v2.sh" }] } }, null, 2)}\n`,
      "utf8",
    );

    const target = createCopilotIntegration();
    const ctx = { cwd, targetId: "copilot", deployRoots: target.deployRoots };
    const prim = (path: string) =>
      ({
        name: "owned-hook",
        type: "hook",
        source: "dependency:demo-pkg",
        packageName: "demo-pkg",
        path,
      }) as const;

    await target.materialize([prim(join(cwd, "pkg", "hook-v1.json"))], ctx);
    await target.materialize([prim(join(cwd, "pkg", "hook-v2.json"))], ctx);

    expect(existsSync(join(cwd, ".github/hooks/user-keep.json"))).toBe(true);
    const owned = readFileSync(join(cwd, ".github/hooks/demo-pkg-owned-hook.json"), "utf8");
    expect(owned).toMatch(/v2\.sh/);
    expect(owned).not.toMatch(/v1\.sh/);
    expect(owned).toMatch(/sessionStart/);
    expect(owned).not.toMatch(/session_start|SessionStart|_apm_source/);
    expect(existsSync(join(cwd, ".github/bapm-hooks.json"))).toBe(true);
  });
});
