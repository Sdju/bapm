/**
 * G7 help surface — top-level search listed; marketplace remains consumer-only
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createIsolatedEnv,
  expectKnownCommand,
  runInEnv,
  type IsolatedEnv,
} from "./search-install-helpers.ts";

describe("mp-search-install G7 help + consumer boundary", () => {
  let env: IsolatedEnv | undefined;

  afterEach(() => {
    env?.cleanup();
    env = undefined;
  });

  test("top-level help lists search", async () => {
    env = createIsolatedEnv();
    const { result, combined } = await runInEnv(env, ["help"]);
    expect(result).toBe(0);
    expect(combined).toMatch(/\bsearch\b/i);
  });

  test("search --help documents --limit and -v", async () => {
    env = createIsolatedEnv();
    const { result, combined } = await runInEnv(env, ["search", "--help"]);
    expectKnownCommand(combined, "search");
    expect(result).toBe(0);
    expect(combined).toMatch(/--limit/);
    expect(combined).toMatch(/-v|--verbose/);
    expect(combined).toMatch(/QUERY@MARKETPLACE|@MARKETPLACE|marketplace/i);
  });

  test("marketplace group rejects deferred pack/find; init is registered", async () => {
    env = createIsolatedEnv();
    for (const sub of ["pack", "find"] as const) {
      const { result, combined } = await runInEnv(env, ["marketplace", sub]);
      expectKnownCommand(combined, "marketplace");
      expect(result).not.toBe(0);
      expect(combined).toMatch(/unknown|invalid|unrecognized|not supported/i);
    }
    const init = await runInEnv(env, ["marketplace", "init", "--help"]);
    expectKnownCommand(init.combined, "marketplace");
    expect(init.result).toBe(0);
    expect(init.combined).not.toMatch(/unknown marketplace subcommand ['"]?init/i);
  });
});
