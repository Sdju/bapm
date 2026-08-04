/**
 * M9 MUST: help lists compile, cache (and MCP path via install).
 * Specs: cli-runtime-surface. Checklist D §21.
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
