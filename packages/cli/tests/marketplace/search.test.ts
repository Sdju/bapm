/**
 * G7 — Top-level bapm search QUERY@MARKETPLACE (--limit, -v)
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  addMarketplace,
  createIsolatedEnv,
  expectKnownCommand,
  runInEnv,
  writeLocalMarketplace,
  type IsolatedEnv,
} from "./search-install-helpers.ts";

describe("mp-search-install G7 top-level search CLI", () => {
  let env: IsolatedEnv | undefined;

  afterEach(() => {
    env?.cleanup();
    env = undefined;
  });

  test("search returns matches with install hint", async () => {
    env = createIsolatedEnv();
    const { alias, marketplaceRoot, pluginName } = writeLocalMarketplace(env);
    expect((await addMarketplace(env, marketplaceRoot, alias)).result).toBe(0);

    const { result, combined } = await runInEnv(env, ["search", `${pluginName}@${alias}`]);
    expectKnownCommand(combined, "search");
    expect(result).toBe(0);
    expect(combined).toMatch(new RegExp(pluginName, "i"));
    expect(combined).toMatch(/bapm install/i);
  });

  test("empty results exit 0 with no-match hint", async () => {
    env = createIsolatedEnv();
    const { alias, marketplaceRoot } = writeLocalMarketplace(env);
    expect((await addMarketplace(env, marketplaceRoot, alias)).result).toBe(0);

    const { result, combined } = await runInEnv(env, ["search", `zzz-no-hit@${alias}`]);
    expectKnownCommand(combined, "search");
    expect(result).toBe(0);
    expect(combined).toMatch(/no .*match|empty|not found|0 result|no plugins/i);
  });

  test("unknown marketplace fails non-zero", async () => {
    env = createIsolatedEnv();
    const { result, combined } = await runInEnv(env, ["search", "demo@no-such-market"]);
    expectKnownCommand(combined, "search");
    expect(result).not.toBe(0);
    expect(combined).toMatch(
      /marketplace.*not.?found|not.?found|unknown marketplace|no-such-market/i,
    );
  });

  test("bad expression without last-@ marketplace fails non-zero", async () => {
    env = createIsolatedEnv();
    const { result, combined } = await runInEnv(env, ["search", "nonsuffix"]);
    expectKnownCommand(combined, "search");
    expect(result).not.toBe(0);
    expect(combined).toMatch(/usage|expression|@|invalid|QUERY@MARKETPLACE|marketplace/i);
  });

  test("unknown search flag fails closed", async () => {
    env = createIsolatedEnv();
    const { result, combined } = await runInEnv(env, ["search", "q@m", "--not-a-flag"]);
    expectKnownCommand(combined, "search");
    expect(result).not.toBe(0);
    expect(combined).toMatch(/unknown.*flag|unrecognized|not-a-flag/i);
  });

  test("--limit defaults to 20", async () => {
    env = createIsolatedEnv();
    const extras = Array.from({ length: 25 }, (_, i) => ({
      name: `plug-${String(i).padStart(2, "0")}`,
      description: `Plugin number ${i}`,
    }));
    const { alias, marketplaceRoot } = writeLocalMarketplace(env, {
      pluginName: "plug-base",
      description: "base",
      extraPlugins: extras,
    });
    expect((await addMarketplace(env, marketplaceRoot, alias)).result).toBe(0);

    const { result, combined } = await runInEnv(env, ["search", `plug@${alias}`]);
    expectKnownCommand(combined, "search");
    expect(result).toBe(0);
    const nameHits = combined.match(/\bplug-(?:base|\d+)\b/gi) ?? [];
    // Default limit 20 — must not print all 26
    expect(nameHits.length).toBeLessThanOrEqual(20);
    expect(nameHits.length).toBeGreaterThan(0);

    const raised = await runInEnv(env, ["search", `plug@${alias}`, "--limit", "30"]);
    expect(raised.result).toBe(0);
    const raisedHits = raised.combined.match(/\bplug-(?:base|\d+)\b/gi) ?? [];
    expect(raisedHits.length).toBeGreaterThan(nameHits.length);
  });

  test("-v / --verbose is accepted", async () => {
    env = createIsolatedEnv();
    const { alias, marketplaceRoot, pluginName } = writeLocalMarketplace(env);
    expect((await addMarketplace(env, marketplaceRoot, alias)).result).toBe(0);

    for (const flag of ["-v", "--verbose"] as const) {
      const { result, combined } = await runInEnv(env, ["search", `${pluginName}@${alias}`, flag]);
      expectKnownCommand(combined, "search");
      expect(result).toBe(0);
      expect(combined).toMatch(new RegExp(pluginName, "i"));
    }
  });
});
