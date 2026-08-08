/**
 * Hooks → `.codex/hooks.json` merge + `.codex/bapm-hooks.json` ownership sidecar;
 * forced target mkdir-on-write.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCodexIntegration } from "../../../src/createCodexIntegration.ts";
import { createTempProject, type TempProject } from "./helpers.ts";

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

describe("codex hooks", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("merges hooks into hooks.json, copies scripts, writes ownership sidecar", async () => {
    project = createTempProject("bapm-codex-hooks-merge-");
    mkdirSync(join(project.cwd, ".codex"), { recursive: true });
    writeFileSync(
      join(project.cwd, ".codex", "hooks.json"),
      `${JSON.stringify(
        {
          version: 1,
          meta: "keep-me",
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

    const target = createCodexIntegration();
    await target.materialize(
      [{ name: "session-start", type: "hook", source: "local", path: hookSrc }],
      { cwd: project.cwd, targetId: "codex", deployRoots: target.deployRoots },
    );

    const hooksPath = join(project.cwd, ".codex", "hooks.json");
    expect(existsSync(hooksPath)).toBe(true);
    const hooksDoc = readJson(hooksPath) as {
      meta?: unknown;
      hooks?: Record<string, Array<{ command?: string; type?: string }>>;
    };
    expect(hooksDoc.meta).toBe("keep-me");
    const session = hooksDoc.hooks?.SessionStart ?? [];
    expect(session.some((e) => e.command === "./keep-user.sh")).toBe(true);
    expect(
      session.some(
        (e) =>
          typeof e.command === "string" &&
          (e.command.includes(".codex/hooks/") || e.command.startsWith(".codex/")),
      ),
    ).toBe(true);
    expect(JSON.stringify(hooksDoc)).not.toMatch(/_apm_source|bapm-owned/i);

    expect(existsSync(join(project.cwd, ".codex", "bapm-hooks.json"))).toBe(true);
    const ownership = readJson(join(project.cwd, ".codex", "bapm-hooks.json"));
    expect(ownership).toHaveProperty("owned");
  });

  test("reinstall replaces owned hooks only and keeps non-owned handlers", async () => {
    project = createTempProject("bapm-codex-hooks-reinstall-");
    mkdirSync(join(project.cwd, ".codex"), { recursive: true });
    writeFileSync(
      join(project.cwd, ".codex", "hooks.json"),
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

    const target = createCodexIntegration();
    const ctx = { cwd: project.cwd, targetId: "codex", deployRoots: target.deployRoots };
    await target.materialize(
      [{ name: "owned-hook", type: "hook", source: "local", path: hookV1 }],
      ctx,
    );
    await target.materialize(
      [{ name: "owned-hook", type: "hook", source: "local", path: hookV2 }],
      ctx,
    );

    const hooksDoc = readJson(join(project.cwd, ".codex", "hooks.json")) as {
      hooks?: Record<string, Array<{ command?: string }>>;
    };
    const session = hooksDoc.hooks?.SessionStart ?? [];
    expect(session.some((e) => e.command === "./keep-user.sh")).toBe(true);
    expect(session.some((e) => typeof e.command === "string" && e.command.includes("v2.sh"))).toBe(
      true,
    );
    expect(session.some((e) => typeof e.command === "string" && e.command.includes("v1.sh"))).toBe(
      false,
    );

    const hooksRaw = readFileSync(join(project.cwd, ".codex", "hooks.json"), "utf8");
    expect(hooksRaw).not.toMatch(/_apm_source|bapm-owned/i);
  });

  test("forced codex creates .codex roots for hooks when absent", async () => {
    project = createTempProject("bapm-codex-hooks-force-mkdir-");
    expect(existsSync(join(project.cwd, ".codex"))).toBe(false);

    mkdirSync(join(project.cwd, "pkg"), { recursive: true });
    writeFileSync(join(project.cwd, "pkg", "run.sh"), "#!/bin/sh\necho hi\n", "utf8");
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

    const target = createCodexIntegration();
    await target.materialize(
      [{ name: "session-start", type: "hook", source: "local", path: hookSrc }],
      { cwd: project.cwd, targetId: "codex", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(project.cwd, ".codex", "hooks.json"))).toBe(true);
    expect(existsSync(join(project.cwd, ".codex", "bapm-hooks.json"))).toBe(true);
  });
});
