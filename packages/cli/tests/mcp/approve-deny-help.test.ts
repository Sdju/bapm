/**
 * cli-runtime-surface — top-level help lists approve and deny.
 * Promoted from sc-executable-governance acceptance.
 */
import { describe, expect, test } from "vite-plus/test";
import { runCli, withCapturedIo } from "./approve-deny-helpers.ts";

describe("CLI approve/deny help surface", () => {
  test("top-level help mentions approve and deny", async () => {
    const { result, stdout, stderr } = await withCapturedIo(() => runCli(["help"]));
    const text = [...stdout, ...stderr].join("\n");
    expect(result).toBe(0);
    expect(text).toMatch(/\bapprove\b/i);
    expect(text).toMatch(/\bdeny\b/i);
  });

  test("approve --help documents --bin, --hook, and default --mcp", async () => {
    const { result, stdout, stderr } = await withCapturedIo(() => runCli(["approve", "--help"]));
    const text = [...stdout, ...stderr].join("\n");
    expect(result).toBe(0);
    expect(text).toMatch(/--bin/);
    expect(text).toMatch(/--hook/);
    expect(text).toMatch(/--mcp/);
  });
});
