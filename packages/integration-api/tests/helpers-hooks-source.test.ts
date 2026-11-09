import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { normalizeHookEventName, readHookSource } from "../src/index.ts";
import type { AttributedPrimitive } from "../src/index.ts";

function prim(path: string, name = "hook"): AttributedPrimitive {
  return { name, type: "hook", source: "local", path };
}

describe("normalizeHookEventName", () => {
  test("camelCase from snake/kebab/Pascal", () => {
    expect(normalizeHookEventName("session_start", "camel")).toBe("sessionStart");
    expect(normalizeHookEventName("SessionStart", "camel")).toBe("sessionStart");
    expect(normalizeHookEventName("pre-tool-use", "camel")).toBe("preToolUse");
  });

  test("PascalCase from snake/kebab/camel", () => {
    expect(normalizeHookEventName("session_start", "pascal")).toBe("SessionStart");
    expect(normalizeHookEventName("sessionStart", "pascal")).toBe("SessionStart");
    expect(normalizeHookEventName("pre-tool-use", "pascal")).toBe("PreToolUse");
  });
});

describe("readHookSource", () => {
  test("returns hooks and version from a valid source", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-hook-"));
    const path = join(cwd, "hook.json");
    writeFileSync(path, JSON.stringify({ version: 2, hooks: { Stop: [{ command: "x" }] } }));
    const result = readHookSource(prim(path));
    expect(result.hooks).toEqual({ Stop: [{ command: "x" }] });
    expect(result.version).toBe(2);
    expect(result.diagnostics).toEqual([]);
  });

  test("reports a missing source", () => {
    const result = readHookSource(prim("/tmp/definitely-missing-bapm-hook.json"), {
      missingCode: "HOST_HOOK_SOURCE_MISSING",
    });
    expect(result.diagnostics[0]?.code).toBe("HOST_HOOK_SOURCE_MISSING");
  });

  test("reports malformed JSON", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-hook-"));
    const path = join(cwd, "hook.json");
    writeFileSync(path, "{ nope");
    const result = readHookSource(prim(path), { invalidCode: "HOST_HOOK_JSON_INVALID" });
    expect(result.diagnostics[0]?.code).toBe("HOST_HOOK_JSON_INVALID");
  });

  test("reports JSON null without throwing", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-hook-"));
    const path = join(cwd, "hook.json");
    writeFileSync(path, "null");
    const result = readHookSource(prim(path), { invalidCode: "HOST_HOOK_JSON_INVALID" });
    expect(result.hooks).toEqual({});
    expect(result.diagnostics[0]?.code).toBe("HOST_HOOK_JSON_INVALID");
    expect(result.diagnostics[0]?.message).toMatch(/must contain an object/);
  });
});
