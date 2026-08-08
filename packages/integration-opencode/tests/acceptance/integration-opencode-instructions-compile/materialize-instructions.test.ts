/**
 * Acceptance (RED): instruction primitives are compile-only (no native rules file).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOpencodeIntegration } from "../../../src/createOpencodeIntegration.ts";

describe("opencode instruction materialize (acceptance)", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("instruction does not write native rules under .opencode/", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-oc-instr-mat-"));
    mkdirSync(join(cwd, ".opencode"), { recursive: true });
    const instr = join(cwd, "guide.md");
    writeFileSync(instr, "# Guide Unique\n", "utf8");

    const target = createOpencodeIntegration();
    const report = await target.materialize(
      [{ name: "guide", type: "instruction", source: "local", path: instr }],
      { cwd, targetId: "opencode", deployRoots: target.deployRoots },
    );

    expect(existsSync(join(cwd, ".opencode", "rules"))).toBe(false);
    expect(existsSync(join(cwd, ".opencode", "instructions"))).toBe(false);
    const underOpencode = existsSync(join(cwd, ".opencode"))
      ? readdirSync(join(cwd, ".opencode"), { withFileTypes: true })
      : [];
    expect(underOpencode.filter((e) => e.isFile()).map((e) => e.name)).toEqual([]);
    const deployed =
      report && typeof report === "object" && "deployedFiles" in report
        ? ((report as { deployedFiles?: { path: string }[] }).deployedFiles ?? [])
        : [];
    expect(deployed).toEqual([]);
  });
});
