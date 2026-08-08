/**
 * Host-package acceptance: Cursor command/hook writers (direct materialize).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCursorIntegration } from "../../../src/index.ts";

describe("commands-hooks-primitives — cursor materialize (host)", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("writes .cursor/commands/<name>.md from command primitive", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-acc-cursor-cmd-"));
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
    const src = join(cwd, "review-pr.prompt.md");
    writeFileSync(
      src,
      "---\ndescription: review\nallowed-tools: Read\nauthor: drop-me\n---\n# Review\n",
      "utf8",
    );

    const target = createCursorIntegration();
    const report = await target.materialize(
      [{ name: "review-pr", type: "command", source: "local", path: src }],
      { cwd, targetId: "cursor", deployRoots: target.deployRoots },
    );
    expect(report && typeof report === "object").toBe(true);
    const deployed = report && typeof report === "object" ? report.deployedFiles : [];
    const diags =
      report && typeof report === "object" && "diagnostics" in report
        ? ((report as { diagnostics?: unknown[] }).diagnostics ?? [])
        : [];

    const dest = join(cwd, ".cursor", "commands", "review-pr.md");
    expect(existsSync(dest)).toBe(true);
    const body = readFileSync(dest, "utf8");
    expect(body).toMatch(/description:\s*review/);
    expect(body).not.toMatch(/^author:/m);
    expect(deployed.map((f: { path: string }) => f.path)).toEqual(
      expect.arrayContaining([".cursor/commands/review-pr.md"]),
    );
    expect(diags.length).toBeGreaterThan(0);
  });

  test("merges hook into hooks.json and rewrites script under .cursor/", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-acc-cursor-hook-"));
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
    const script = join(cwd, "pkg", "run.sh");
    mkdirSync(join(cwd, "pkg"), { recursive: true });
    writeFileSync(script, "#!/bin/sh\necho hi\n", "utf8");
    const hookSrc = join(cwd, "pkg", "session-start.json");
    writeFileSync(
      hookSrc,
      JSON.stringify({
        version: 1,
        hooks: { sessionStart: [{ command: "./run.sh" }] },
      }),
      "utf8",
    );
    writeFileSync(
      join(cwd, ".cursor", "hooks.json"),
      JSON.stringify({
        version: 1,
        hooks: { sessionStart: [{ command: "./keep-user.sh" }] },
      }),
      "utf8",
    );

    const target = createCursorIntegration();
    await target.materialize(
      [{ name: "session-start", type: "hook", source: "local", path: hookSrc }],
      { cwd, targetId: "cursor", deployRoots: target.deployRoots },
    );

    const hooks = JSON.parse(readFileSync(join(cwd, ".cursor", "hooks.json"), "utf8")) as {
      hooks: { sessionStart: Array<{ command: string }> };
    };
    expect(hooks.hooks.sessionStart.some((e) => e.command === "./keep-user.sh")).toBe(true);
    expect(
      hooks.hooks.sessionStart.some(
        (e) => e.command.includes(".cursor/") || e.command.startsWith(".cursor/"),
      ),
    ).toBe(true);
  });
});
