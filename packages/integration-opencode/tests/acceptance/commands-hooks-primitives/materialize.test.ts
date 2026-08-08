/**
 * Host-package acceptance: OpenCode commands + explicit hooks skip.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOpencodeIntegration } from "../../../src/index.ts";

describe("commands-hooks-primitives — opencode materialize (host)", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("writes .opencode/commands/<name>.md from command primitive", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-acc-oc-cmd-"));
    mkdirSync(join(cwd, ".opencode"), { recursive: true });
    const src = join(cwd, "review-pr.prompt.md");
    writeFileSync(src, "---\ndescription: review\n---\n# Review\n", "utf8");

    const target = createOpencodeIntegration();
    const report = await target.materialize(
      [{ name: "review-pr", type: "command", source: "local", path: src }],
      { cwd, targetId: "opencode", deployRoots: target.deployRoots },
    );
    expect(report && typeof report === "object").toBe(true);
    const deployed = report && typeof report === "object" ? report.deployedFiles : [];

    const dest = join(cwd, ".opencode", "commands", "review-pr.md");
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, "utf8")).toMatch(/Review/);
    expect(deployed.map((f: { path: string }) => f.path)).toEqual(
      expect.arrayContaining([".opencode/commands/review-pr.md"]),
    );
    expect(existsSync(join(cwd, "opencode.json"))).toBe(false);
  });

  test("skips hooks with inspectable diagnostic and does not write hooks harness", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-acc-oc-hook-"));
    mkdirSync(join(cwd, ".opencode"), { recursive: true });
    const hookSrc = join(cwd, "pre.json");
    writeFileSync(
      hookSrc,
      JSON.stringify({ version: 1, hooks: { sessionStart: [{ command: "./x.sh" }] } }),
      "utf8",
    );

    const target = createOpencodeIntegration();
    const report = await target.materialize(
      [{ name: "pre", type: "hook", source: "local", path: hookSrc }],
      { cwd, targetId: "opencode", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(cwd, ".opencode", "hooks.json"))).toBe(false);
    expect(existsSync(join(cwd, ".opencode", "hooks"))).toBe(false);
    const diags =
      report && typeof report === "object" && "diagnostics" in report
        ? ((report as { diagnostics?: unknown[] }).diagnostics ?? [])
        : [];
    expect(diags.length).toBeGreaterThan(0);
    expect(JSON.stringify(diags)).toMatch(/hook|skip|not supported|unsupported/i);
  });
});
