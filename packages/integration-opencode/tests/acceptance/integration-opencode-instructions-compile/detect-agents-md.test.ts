/**
 * Acceptance (RED): lone AGENTS.md is not an OpenCode detect signal.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOpencodeIntegration } from "../../../src/createOpencodeIntegration.ts";

describe("opencode detect vs AGENTS.md (acceptance)", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("lone AGENTS.md is not OpenCode", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-oc-detect-agents-"));
    writeFileSync(join(cwd, "AGENTS.md"), "# AGENTS.md\n", "utf8");
    expect(createOpencodeIntegration().detect({ cwd })).toBe(false);
  });
});
