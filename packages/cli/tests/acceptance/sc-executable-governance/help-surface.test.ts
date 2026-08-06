/**
 * cli-runtime-surface — top-level help lists approve and deny.
 */
import { describe, expect, test } from "vite-plus/test";
import { runCli, withCapturedIo } from "./helpers.ts";

describe("sc-executable-governance CLI help surface", () => {
  test("top-level help mentions approve and deny", async () => {
    const { result, stdout, stderr } = await withCapturedIo(() => runCli(["help"]));
    const text = [...stdout, ...stderr].join("\n");
    expect(result).toBe(0);
    expect(text).toMatch(/\bapprove\b/i);
    expect(text).toMatch(/\bdeny\b/i);
  });
});
