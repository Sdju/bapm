/**
 * Detect: .opencode/ directory or project-root opencode.json / opencode.jsonc.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createOpencodeTarget, createTempDir, type TempDir } from "./helpers.ts";

describe("integration-opencode-runtime · detect", () => {
  let project: TempDir | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("detects .opencode/ directory", async () => {
    project = createTempDir("bapm-acc-oc-detect-dir-");
    mkdirSync(join(project.cwd, ".opencode"), { recursive: true });
    const target = await createOpencodeTarget();
    expect(await target.detect({ cwd: project.cwd })).toBe(true);
  });

  test("detects opencode.json without .opencode/", async () => {
    project = createTempDir("bapm-acc-oc-detect-json-");
    writeFileSync(join(project.cwd, "opencode.json"), "{}\n", "utf8");
    const target = await createOpencodeTarget();
    expect(await target.detect({ cwd: project.cwd })).toBe(true);
  });

  test("detects opencode.jsonc without .opencode/", async () => {
    project = createTempDir("bapm-acc-oc-detect-jsonc-");
    writeFileSync(join(project.cwd, "opencode.jsonc"), "{}\n", "utf8");
    const target = await createOpencodeTarget();
    expect(await target.detect({ cwd: project.cwd })).toBe(true);
  });

  test("no OpenCode signal → detect false", async () => {
    project = createTempDir("bapm-acc-oc-detect-none-");
    const target = await createOpencodeTarget();
    expect(await target.detect({ cwd: project.cwd })).toBe(false);
  });
});
