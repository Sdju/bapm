/**
 * p6d — CLI help / flag surface for `bapm policy status`.
 * Spec: cli-runtime-surface.
 */
import { describe, expect, test } from "vite-plus/test";
import { expectKnownCommand, runCli, withCapturedIo } from "./helpers.ts";

describe("p6d CLI policy help surface", () => {
  test("top-level help mentions policy", async () => {
    const viaFlag = await withCapturedIo(() => runCli(["--help"]));
    const viaHelp = await withCapturedIo(() => runCli(["help"]));
    const text = [
      ...viaFlag.stdout,
      ...viaFlag.stderr,
      ...viaHelp.stdout,
      ...viaHelp.stderr,
    ].join("\n");

    expect(viaFlag.result === 0 || viaHelp.result === 0).toBe(true);
    expect(text).toMatch(/\bpolicy\b/i);
  });

  test("policy status --help documents --json --policy --no-policy --check", async () => {
    const { result, stdout, stderr } = await withCapturedIo(() =>
      runCli(["policy", "status", "--help"]),
    );
    const combined = [...stdout, ...stderr].join("\n");
    expectKnownCommand(combined, "policy");
    expect(result).toBe(0);
    expect(combined).toMatch(/--json/);
    expect(combined).toMatch(/--policy/);
    expect(combined).toMatch(/--no-policy/);
    expect(combined).toMatch(/--check/);
    expect(combined).not.toMatch(/--no-cache/);
  });

  test("unknown flag on policy status fails closed naming the flag", async () => {
    const { result, stdout, stderr } = await withCapturedIo(() =>
      runCli(["policy", "status", "--not-a-real-flag"]),
    );
    const combined = [...stdout, ...stderr].join("\n");
    expectKnownCommand(combined, "policy");
    expect(result).not.toBe(0);
    expect(combined).toMatch(/not-a-real-flag|unknown|unrecognized/i);
  });

  test("policy group exposes status only (no explain)", async () => {
    const help = await withCapturedIo(() => runCli(["policy", "--help"]));
    const helpText = [...help.stdout, ...help.stderr].join("\n");
    expectKnownCommand(helpText, "policy");
    expect(helpText).toMatch(/\bstatus\b/i);
    expect(helpText).not.toMatch(/\bexplain\b/i);

    // explain must not become a registered happy-path subcommand in P6d
    const explain = await withCapturedIo(() => runCli(["policy", "explain"]));
    expect(explain.result).not.toBe(0);
  });
});
