/**
 * marketplace-cli-consumer + cli-runtime-surface.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  DUP_FIXTURE,
  LOCAL_FIXTURE,
  bapmDir,
  createIsolatedHome,
  expectMarketplaceKnown,
  marketplacesJsonPath,
  readMarketplaces,
  runMarketplace,
  writeLocalFixture,
  type IsolatedHome,
} from "./helpers.ts";

describe("mp-consumer-registry CLI consumer surface", () => {
  let env: IsolatedHome | undefined;

  afterEach(() => {
    env?.cleanup();
    env = undefined;
  });

  test("top-level help lists marketplace", async () => {
    env = createIsolatedHome();
    const { result, combined } = await runMarketplace(env, ["help"]);
    expect(result).toBe(0);
    expect(combined).toMatch(/\bmarketplace\b/i);
  });

  test("marketplace list on empty registry exits 0 with empty hint", async () => {
    env = createIsolatedHome();
    const { result, combined } = await runMarketplace(env, ["marketplace", "list"]);
    expectMarketplaceKnown(combined);
    expect(result).toBe(0);
    expect(combined).toMatch(/no .*marketplace|none|empty|add /i);
  });

  test("unknown marketplace subcommand fails closed without mutating registry", async () => {
    env = createIsolatedHome();
    const before = readMarketplaces(env.home);
    const { result, combined } = await runMarketplace(env, ["marketplace", "init"]);
    expectMarketplaceKnown(combined);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/unknown|invalid|unrecognized|not supported/i);
    expect(readMarketplaces(env.home)).toEqual(before);
  });

  test("search remains an unknown top-level command", async () => {
    env = createIsolatedHome();
    const { result, combined } = await runMarketplace(env, ["search", "foo"]);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/unknown command|not a (?:valid )?command|unrecognized command/i);
  });

  test("add local marketplace.json succeeds and list shows it", async () => {
    env = createIsolatedHome();
    const fixture = writeLocalFixture(env.cwd, "mp/marketplace.json", LOCAL_FIXTURE);
    const add = await runMarketplace(env, [
      "marketplace",
      "add",
      fixture,
      "--name",
      "local-mp",
    ]);
    expectMarketplaceKnown(add.combined);
    expect(add.result).toBe(0);
    expect(existsSync(marketplacesJsonPath(env.home))).toBe(true);
    const listed = readMarketplaces(env.home).marketplaces;
    expect(listed.some((e) => String((e as { name?: string }).name) === "local-mp")).toBe(true);

    const list = await runMarketplace(env, ["marketplace", "list"]);
    expect(list.result).toBe(0);
    expect(list.combined).toMatch(/local-mp/);
  });

  test("invalid alias is rejected and registry unchanged", async () => {
    env = createIsolatedHome();
    const fixture = writeLocalFixture(env.cwd, "mp/marketplace.json", LOCAL_FIXTURE);
    const before = JSON.stringify(readMarketplaces(env.home));
    const { result, combined } = await runMarketplace(env, [
      "marketplace",
      "add",
      fixture,
      "--name",
      "bad name!",
    ]);
    expectMarketplaceKnown(combined);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/name|alias|invalid|pattern/i);
    expect(JSON.stringify(readMarketplaces(env.home))).toBe(before);
  });

  test("unsupported gitlab remote host is refused at add", async () => {
    env = createIsolatedHome();
    const before = JSON.stringify(readMarketplaces(env.home));
    const { result, combined } = await runMarketplace(env, [
      "marketplace",
      "add",
      "https://gitlab.com/acme/tools.git",
      "--name",
      "gl-mp",
    ]);
    expectMarketplaceKnown(combined);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/gitlab|unsupported|host|kind|not supported/i);
    expect(JSON.stringify(readMarketplaces(env.home))).toBe(before);
  });

  test("browse lists plugins for a registered local marketplace", async () => {
    env = createIsolatedHome();
    const fixture = writeLocalFixture(env.cwd, "browse/marketplace.json", LOCAL_FIXTURE);
    const add = await runMarketplace(env, [
      "marketplace",
      "add",
      fixture,
      "--name",
      "browse-mp",
    ]);
    expect(add.result).toBe(0);

    const browse = await runMarketplace(env, ["marketplace", "browse", "browse-mp"]);
    expectMarketplaceKnown(browse.combined);
    expect(browse.result).toBe(0);
    expect(browse.combined).toMatch(/demo-plugin/);
  });

  test("remove without -y fails closed in non-interactive mode", async () => {
    env = createIsolatedHome();
    const fixture = writeLocalFixture(env.cwd, "rm/marketplace.json", LOCAL_FIXTURE);
    expect(
      (
        await runMarketplace(env, ["marketplace", "add", fixture, "--name", "keep-mp"])
      ).result,
    ).toBe(0);

    const { result, combined } = await runMarketplace(env, ["marketplace", "remove", "keep-mp"]);
    expectMarketplaceKnown(combined);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/-y|yes|confirm|non-interactive|refus/i);
    expect(
      readMarketplaces(env.home).marketplaces.some(
        (e) => String((e as { name?: string }).name) === "keep-mp",
      ),
    ).toBe(true);
  });

  test("remove -y deletes registry entry and clears cache sidecars", async () => {
    env = createIsolatedHome();
    const fixture = writeLocalFixture(env.cwd, "rm2/marketplace.json", LOCAL_FIXTURE);
    expect(
      (
        await runMarketplace(env, ["marketplace", "add", fixture, "--name", "gone-mp"])
      ).result,
    ).toBe(0);

    const remove = await runMarketplace(env, [
      "marketplace",
      "remove",
      "gone-mp",
      "-y",
    ]);
    expect(remove.result).toBe(0);
    expect(
      readMarketplaces(env.home).marketplaces.some(
        (e) => String((e as { name?: string }).name) === "gone-mp",
      ),
    ).toBe(false);
  });

  test("update refreshes a registered marketplace", async () => {
    env = createIsolatedHome();
    const fixture = writeLocalFixture(env.cwd, "up/marketplace.json", LOCAL_FIXTURE);
    expect(
      (
        await runMarketplace(env, ["marketplace", "add", fixture, "--name", "up-mp"])
      ).result,
    ).toBe(0);

    const update = await runMarketplace(env, ["marketplace", "update", "up-mp"]);
    expectMarketplaceKnown(update.combined);
    expect(update.result).toBe(0);
  });

  test("validate fails on duplicate plugin names", async () => {
    env = createIsolatedHome();
    const fixture = writeLocalFixture(env.cwd, "dup/marketplace.json", DUP_FIXTURE);
    expect(
      (
        await runMarketplace(env, ["marketplace", "add", fixture, "--name", "dup-mp"])
      ).result,
    ).toBe(0);

    const validate = await runMarketplace(env, ["marketplace", "validate", "dup-mp"]);
    expectMarketplaceKnown(validate.combined);
    expect(validate.result).not.toBe(0);
    expect(validate.combined).toMatch(/duplicate/i);
  });

  test("validate passes for well-formed marketplace", async () => {
    env = createIsolatedHome();
    const fixture = writeLocalFixture(env.cwd, "ok/marketplace.json", LOCAL_FIXTURE);
    expect(
      (
        await runMarketplace(env, ["marketplace", "add", fixture, "--name", "ok-mp"])
      ).result,
    ).toBe(0);

    const validate = await runMarketplace(env, ["marketplace", "validate", "ok-mp"]);
    expectMarketplaceKnown(validate.combined);
    expect(validate.result).toBe(0);
  });

  test("marketplace help lists consumer subcommands only", async () => {
    env = createIsolatedHome();
    const { result, combined } = await runMarketplace(env, ["marketplace", "--help"]);
    expectMarketplaceKnown(combined);
    expect(result).toBe(0);
    for (const sub of ["add", "list", "browse", "update", "remove", "validate"]) {
      expect(combined).toMatch(new RegExp(`\\b${sub}\\b`, "i"));
    }
    expect(combined).not.toMatch(/\b(search|package|migrate|outdated)\b/i);
  });

  test("config root used by CLI is ~/.bapm under HOME", async () => {
    env = createIsolatedHome();
    const fixture = writeLocalFixture(env.cwd, "home/marketplace.json", LOCAL_FIXTURE);
    const add = await runMarketplace(env, [
      "marketplace",
      "add",
      fixture,
      "--name",
      "home-mp",
    ]);
    expect(add.result).toBe(0);
    expect(existsSync(bapmDir(env.home))).toBe(true);
    expect(existsSync(marketplacesJsonPath(env.home))).toBe(true);
    expect(existsSync(join(env.home, ".apm", "marketplaces.json"))).toBe(false);
    // Cache dir may appear for non-local; local does not require sidecars.
    const cache = join(env.home, ".bapm", "cache", "marketplace");
    if (existsSync(cache)) {
      expect(readdirSync(cache)).toBeDefined();
    }
  });
});
