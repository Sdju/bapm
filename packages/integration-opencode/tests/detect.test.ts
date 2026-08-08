/**
 * Detect: .opencode/ directory or project-root opencode.json / opencode.jsonc
 * (promoted from integration-opencode-runtime acceptance).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOpencodeIntegration } from "../src/index.ts";

describe("opencode detect", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("detects .opencode/ directory", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-oc-detect-dir-"));
    mkdirSync(join(cwd, ".opencode"), { recursive: true });
    expect(createOpencodeIntegration().detect({ cwd })).toBe(true);
  });

  test("detects opencode.json without .opencode/", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-oc-detect-json-"));
    writeFileSync(join(cwd, "opencode.json"), "{}\n", "utf8");
    expect(createOpencodeIntegration().detect({ cwd })).toBe(true);
  });

  test("detects opencode.jsonc without .opencode/", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-oc-detect-jsonc-"));
    writeFileSync(join(cwd, "opencode.jsonc"), "{}\n", "utf8");
    expect(createOpencodeIntegration().detect({ cwd })).toBe(true);
  });

  test("no OpenCode signal → detect false", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-oc-detect-none-"));
    expect(createOpencodeIntegration().detect({ cwd })).toBe(false);
  });

  test("lone AGENTS.md is not OpenCode", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-oc-detect-agents-"));
    writeFileSync(join(cwd, "AGENTS.md"), "# AGENTS.md\n", "utf8");
    expect(createOpencodeIntegration().detect({ cwd })).toBe(false);
  });
});
