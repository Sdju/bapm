/**
 * G7 — CLI unlock: gitlab / enterprise --host / help rewrite; generic git refuse.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  FIXTURE_MP,
  createIsolatedHome,
  marketplacesJsonPath,
  readMarketplaces,
  runMarketplace,
  withEnv,
  type IsolatedHome,
} from "./helpers.ts";
import { existsSync } from "node:fs";

describe("mp-hosts-auth CLI consumer unlock", () => {
  let env: IsolatedHome | undefined;
  let prevFetch: typeof globalThis.fetch | undefined;

  afterEach(() => {
    if (prevFetch) {
      globalThis.fetch = prevFetch;
      prevFetch = undefined;
    }
    env?.cleanup();
    env = undefined;
    for (const k of ["GITHUB_HOST", "GITLAB_HOST", "GITLAB_TOKEN", "GITHUB_TOKEN", "GH_TOKEN"]) {
      delete process.env[k];
    }
  });

  test("marketplace help must not claim github.com-only v1", async () => {
    env = createIsolatedHome();
    const { result, combined } = await runMarketplace(env, ["marketplace", "--help"]);
    expect(result).toBe(0);
    expect(combined).toMatch(/\bmarketplace\b/i);
    expect(combined).not.toMatch(/github\.com only in v1|only github\.com in v1/i);
    expect(combined).toMatch(/--host/i);
  });

  test("gitlab marketplace add accepted for probe (mocked fetch)", async () => {
    env = createIsolatedHome();
    prevFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(FIXTURE_MP, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    await withEnv({ GITLAB_TOKEN: "glpat-CLI_ADD", GITHUB_TOKEN: undefined }, async () => {
      const before = JSON.stringify(readMarketplaces(env!.home));
      const { result, combined } = await runMarketplace(env!, [
        "marketplace",
        "add",
        "https://gitlab.com/acme/tools.git",
        "--name",
        "gl-mp",
      ]);
      expect(combined).not.toMatch(
        /gitlab\/ado\/generic-git not supported|not supported in this release.*gitlab|only github\.com/i,
      );
      expect(result, `gitlab add should succeed on probe:\n${combined}`).toBe(0);
      expect(existsSync(marketplacesJsonPath(env!.home))).toBe(true);
      const listed = readMarketplaces(env!.home).marketplaces;
      expect(listed.some((e) => String((e as { name?: string }).name) === "gl-mp")).toBe(true);
      expect(JSON.stringify(readMarketplaces(env!.home))).not.toBe(before);
    });
  });

  test("enterprise --host with GITHUB_HOST GHES is not refused solely for non-github.com", async () => {
    env = createIsolatedHome();
    prevFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(FIXTURE_MP, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    await withEnv({ GITHUB_HOST: "ghe.example.com" }, async () => {
      const { result, combined } = await runMarketplace(env!, [
        "marketplace",
        "add",
        "acme/tools",
        "--host",
        "ghe.example.com",
        "--name",
        "ghes-mp",
      ]);
      expect(combined).not.toMatch(
        /only github\.com|Unsupported marketplace host\/kind 'git'|generic-git not supported/i,
      );
      expect(result, `GHES --host add should unlock:\n${combined}`).toBe(0);
      expect(
        readMarketplaces(env!.home).marketplaces.some(
          (e) => String((e as { name?: string }).name) === "ghes-mp",
        ),
      ).toBe(true);
    });
  });

  test("*.ghe.com --host accepted (not github.com-only refuse)", async () => {
    env = createIsolatedHome();
    prevFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(FIXTURE_MP, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const { result, combined } = await runMarketplace(env, [
      "marketplace",
      "add",
      "acme/tools",
      "--host",
      "corp.ghe.com",
      "--name",
      "ghe-cloud-mp",
    ]);
    expect(combined).not.toMatch(/only github\.com in v1|github\.com only/i);
    expect(result, `*.ghe.com --host should unlock:\n${combined}`).toBe(0);
  });

  test("generic git host refused at add with clear message", async () => {
    env = createIsolatedHome();
    const before = JSON.stringify(readMarketplaces(env.home));
    const { result, combined } = await runMarketplace(env, [
      "marketplace",
      "add",
      "https://git.example.invalid/acme/tools.git",
      "--name",
      "generic-mp",
    ]);
    expect(result).not.toBe(0);
    expect(combined).toMatch(/unsupported|not supported|generic|git kind|out of scope|host/i);
    expect(JSON.stringify(readMarketplaces(env.home))).toBe(before);
  });
});
