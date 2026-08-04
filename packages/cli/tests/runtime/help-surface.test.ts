/**
 * CLI help surface: compile/cache (M9), publish/self-update (M10), MCP install path.
 * Specs: cli-runtime-surface.
 */
import { expect, test } from "vite-plus/test";
import { runCli } from "../../src/index.ts";
import { withCapturedIo } from "../mcp/helpers.ts";

test("help lists compile and cache", async () => {
  const { result, stdout, stderr } = await withCapturedIo(() => runCli(["help"]));
  const text = [...stdout, ...stderr].join("\n");
  expect(result).toBe(0);
  expect(text).toMatch(/\bcompile\b/i);
  expect(text).toMatch(/\bcache\b/i);
});

test("help lists publish and self-update", async () => {
  const { result, stdout, stderr } = await withCapturedIo(() => runCli(["help"]));
  const text = [...stdout, ...stderr].join("\n");
  expect(result).toBe(0);
  expect(text).toMatch(/\bpublish\b/i);
  expect(text).toMatch(/\bself-update\b/i);
  if (/unknown command|not a (?:valid )?command|unrecognized command/i.test(text)) {
    throw new Error(`CLI treated "help" as unknown command:\n${text}`);
  }
});

test("install help documents MCP / trust-transitive path", async () => {
  const viaInstallHelp = await withCapturedIo(() => runCli(["install", "--help"]));
  const viaHelpInstall = await withCapturedIo(() => runCli(["help", "install"]));
  const text = [
    ...viaInstallHelp.stdout,
    ...viaInstallHelp.stderr,
    ...viaHelpInstall.stdout,
    ...viaHelpInstall.stderr,
  ].join("\n");

  expect(viaInstallHelp.result === 0 || viaHelpInstall.result === 0).toBe(true);
  expect(text).toMatch(/mcp|trust-transitive-mcp/i);
});
