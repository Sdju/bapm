/**
 * `bapm config` — user defaults in ~/.bapm/config.json with grant preservation.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { runConfigCli, type ConfigCliDeps } from "../../src/modules/Config/index.ts";
import { withCapturedIo, runInProject } from "../lifecycle/helpers.ts";
import { linkCursorIntegration, writeText as writeProjectText } from "../install/helpers.ts";

type Store = { root: string; deps: ConfigCliDeps; cleanup: () => void };

function createStore(config?: Record<string, unknown>): Store {
  const root = mkdtempSync(join(tmpdir(), "bapm-user-config-"));
  if (config) {
    writeFileSync(join(root, "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
  }
  return {
    root,
    deps: { name: "bapm", manifestFile: "bapm.yml", lockFile: "bapm.lock.yaml", configRoot: root },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function readDoc(root: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, "config.json"), "utf8")) as Record<string, unknown>;
}

describe("bapm config storage", () => {
  let store: Store | undefined;

  afterEach(() => {
    store?.cleanup();
    store = undefined;
  });

  test("set target preserves existing executables allow/deny grants", async () => {
    store = createStore({
      executables: {
        allow: { "mcp-dep": { mcp: true, bin: true } },
        deny: { "bad-dep": { hook: true } },
      },
    });

    const result = await withCapturedIo(() =>
      runConfigCli(store!.deps, { args: ["set", "target", "cursor"] }),
    );
    expect(result.result.exitCode).toBe(0);

    const document = readDoc(store.root);
    expect(document.target).toBe("cursor");
    expect(document.executables).toEqual({
      allow: { "mcp-dep": { mcp: true, bin: true } },
      deny: { "bad-dep": { hook: true } },
    });
  });

  test("unset target keeps grants and unrelated keys", async () => {
    store = createStore({
      target: "cursor",
      other: { keep: true },
      executables: { allow: { "mcp-dep": { mcp: true } }, deny: {} },
    });

    const result = await withCapturedIo(() =>
      runConfigCli(store!.deps, { args: ["unset", "target"] }),
    );
    expect(result.result.exitCode).toBe(0);
    const document = readDoc(store.root);
    expect(document.target).toBeUndefined();
    expect(document.other).toEqual({ keep: true });
    expect(document.executables).toEqual({
      allow: { "mcp-dep": { mcp: true } },
      deny: {},
    });
  });

  test("invalid target id is rejected without writing", async () => {
    store = createStore({ executables: { allow: { keep: { mcp: true } }, deny: {} } });
    const before = readDoc(store.root);

    const result = await withCapturedIo(() =>
      runConfigCli(store!.deps, { args: ["set", "target", "not a target"] }),
    );
    expect(result.result.exitCode).toBe(1);
    expect(result.stderr.join("\n")).toMatch(/invalid target/i);
    expect(readDoc(store.root)).toEqual(before);
  });

  test("get and list --json expose the configured target", async () => {
    store = createStore({ executables: { allow: {}, deny: {} } });
    await withCapturedIo(() => runConfigCli(store!.deps, { args: ["set", "target", "claude"] }));

    const got = await withCapturedIo(() => runConfigCli(store!.deps, { args: ["get", "target"] }));
    expect(got.result.exitCode).toBe(0);
    expect(got.stdout.join("\n")).toBe("claude");

    const listed = await withCapturedIo(() =>
      runConfigCli(store!.deps, { args: ["list", "--json"] }),
    );
    expect(listed.result.exitCode).toBe(0);
    expect(JSON.parse(listed.stdout.join("\n"))).toMatchObject({
      target: "claude",
      executables: { allow: {}, deny: {} },
    });
  });

  test("mcp-registry-url set/get/unset normalizes the URL and preserves user keys", async () => {
    store = createStore({
      custom: { keep: true },
      executables: { allow: { "mcp-dep": { mcp: true } }, deny: {} },
    });

    const set = await withCapturedIo(() =>
      runConfigCli(store!.deps, {
        args: ["set", "mcp-registry-url", "https://mcp.internal.example.com/"],
      }),
    );
    expect(set.result.exitCode).toBe(0);
    expect(readDoc(store.root)).toMatchObject({
      "mcp-registry-url": "https://mcp.internal.example.com",
      custom: { keep: true },
      executables: { allow: { "mcp-dep": { mcp: true } }, deny: {} },
    });

    const got = await withCapturedIo(() =>
      runConfigCli(store!.deps, { args: ["get", "mcp-registry-url"] }),
    );
    expect(got.result.exitCode).toBe(0);
    expect(got.stdout.join("\n")).toBe("https://mcp.internal.example.com");

    const unset = await withCapturedIo(() =>
      runConfigCli(store!.deps, { args: ["unset", "mcp-registry-url"] }),
    );
    expect(unset.result.exitCode).toBe(0);
    const document = readDoc(store.root);
    expect(document["mcp-registry-url"]).toBeUndefined();
    expect(document.custom).toEqual({ keep: true });
    expect(document.executables).toEqual({ allow: { "mcp-dep": { mcp: true } }, deny: {} });
  });

  test("mcp-registry-url rejects non-http(s), credentials, queries, and missing hosts", async () => {
    store = createStore({ other: { keep: true } });
    const before = readDoc(store.root);

    for (const value of [
      "ftp://example.com",
      "example.com",
      "https://user:pass@example.com",
      "https://example.com/path?query=1",
      "https://example.com/path#fragment",
    ]) {
      const result = await withCapturedIo(() =>
        runConfigCli(store!.deps, { args: ["set", "mcp-registry-url", value] }),
      );
      expect(result.result.exitCode).toBe(1);
      expect(result.stderr.join("\n")).toMatch(/mcp-registry-url/i);
      expect(readDoc(store.root)).toEqual(before);
    }
  });

  test("temp-dir stores an absolute existing writable directory", async () => {
    store = createStore({ other: { keep: true } });
    const work = join(store.root, "work");
    mkdirSync(work);

    const set = await withCapturedIo(() =>
      runConfigCli(store!.deps, { args: ["set", "temp-dir", work] }),
    );
    expect(set.result.exitCode).toBe(0);
    expect(readDoc(store.root)).toMatchObject({ "temp-dir": work, other: { keep: true } });

    const got = await withCapturedIo(() =>
      runConfigCli(store!.deps, { args: ["get", "temp-dir"] }),
    );
    expect(got.stdout.join("\n")).toBe(work);

    const missing = await withCapturedIo(() =>
      runConfigCli(store!.deps, { args: ["set", "temp-dir", join(store!.root, "missing")] }),
    );
    expect(missing.result.exitCode).toBe(1);
    expect(missing.stderr.join("\n")).toMatch(/does not exist/i);

    const unset = await withCapturedIo(() =>
      runConfigCli(store!.deps, { args: ["unset", "temp-dir"] }),
    );
    expect(unset.result.exitCode).toBe(0);
    expect(readDoc(store.root)["temp-dir"]).toBeUndefined();
  });

  test("self-update.channel set/get/unset validates stable vs prerelease", async () => {
    store = createStore({ other: { keep: true } });

    const set = await withCapturedIo(() =>
      runConfigCli(store!.deps, { args: ["set", "self-update.channel", "Prerelease"] }),
    );
    expect(set.result.exitCode).toBe(0);
    expect(readDoc(store.root)).toMatchObject({
      "self-update": { channel: "prerelease" },
      other: { keep: true },
    });

    const got = await withCapturedIo(() =>
      runConfigCli(store!.deps, { args: ["get", "self-update.channel"] }),
    );
    expect(got.stdout.join("\n")).toBe("prerelease");

    const invalid = await withCapturedIo(() =>
      runConfigCli(store!.deps, { args: ["set", "self-update.channel", "nightly"] }),
    );
    expect(invalid.result.exitCode).toBe(1);
    expect(invalid.stderr.join("\n")).toMatch(/stable|prerelease/i);

    const unset = await withCapturedIo(() =>
      runConfigCli(store!.deps, { args: ["unset", "self-update.channel"] }),
    );
    expect(unset.result.exitCode).toBe(0);
    const document = readDoc(store.root);
    expect(document["self-update"]).toBeUndefined();
    expect(document.other).toEqual({ keep: true });
  });

  test("unknown keys are rejected by get/set/unset with the valid key list", async () => {
    store = createStore({ other: { keep: true } });
    const before = readDoc(store.root);

    for (const args of [
      ["get", "bogus"],
      ["set", "bogus", "value"],
      ["unset", "bogus"],
    ]) {
      const result = await withCapturedIo(() => runConfigCli(store!.deps, { args }));
      expect(result.result.exitCode).toBe(1);
      expect(result.stderr.join("\n")).toMatch(/Unknown config key/i);
      expect(result.stderr.join("\n")).toMatch(/target/);
      expect(result.stderr.join("\n")).toMatch(/mcp-registry-url/);
      expect(result.stderr.join("\n")).toMatch(/temp-dir/);
      expect(result.stderr.join("\n")).toMatch(/self-update\.channel/);
    }
    expect(readDoc(store.root)).toEqual(before);
  });

  test("list --json includes every known key and preserves unknown document keys", async () => {
    store = createStore({
      other: { keep: true },
      "custom-key": "custom-value",
      executables: { allow: { pkg: { bin: true } }, deny: {} },
    });

    const empty = await withCapturedIo(() =>
      runConfigCli(store!.deps, { args: ["list", "--json"] }),
    );
    expect(JSON.parse(empty.stdout.join("\n"))).toMatchObject({
      target: null,
      "mcp-registry-url": null,
      "temp-dir": null,
      "self-update.channel": null,
      other: { keep: true },
      "custom-key": "custom-value",
      executables: { allow: { pkg: { bin: true } }, deny: {} },
    });

    await withCapturedIo(() =>
      runConfigCli(store!.deps, { args: ["set", "mcp-registry-url", "https://example.com"] }),
    );
    await withCapturedIo(() =>
      runConfigCli(store!.deps, { args: ["set", "self-update.channel", "prerelease"] }),
    );
    const listed = await withCapturedIo(() =>
      runConfigCli(store!.deps, { args: ["list", "--json"] }),
    );
    const json = JSON.parse(listed.stdout.join("\n")) as Record<string, unknown>;
    expect(json).toMatchObject({
      "mcp-registry-url": "https://example.com",
      "self-update.channel": "prerelease",
      other: { keep: true },
      "custom-key": "custom-value",
    });
    expect(json["self-update"]).toBeUndefined();
  });

  test("help documents the validated key registry", async () => {
    store = createStore();
    const result = await withCapturedIo(() => runConfigCli(store!.deps, { args: ["--help"] }));
    expect(result.result.exitCode).toBe(0);
    const text = result.stdout.join("\n");
    for (const key of ["target", "mcp-registry-url", "temp-dir", "self-update.channel"]) {
      expect(text).toContain(key);
    }
    expect(text).toMatch(/stored-only/i);
  });
});

describe("bapm config CLI wiring", () => {
  let project: { cwd: string; cleanup: () => void } | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("config set target persists under an isolated HOME and lists it", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-config-cli-"));
    const home = mkdtempSync(join(tmpdir(), "bapm-config-home-"));
    project = {
      cwd,
      cleanup: () => {
        rmSync(cwd, { recursive: true, force: true });
        rmSync(home, { recursive: true, force: true });
      },
    };

    const set = await runInProject(cwd, ["config", "set", "target", "cursor"], { HOME: home });
    expect(set.result).toBe(0);
    expect(set.combined).not.toMatch(/unknown command/i);
    expect(readDoc(join(home, ".bapm")).target).toBe("cursor");

    const listed = await runInProject(cwd, ["config", "list", "--json"], { HOME: home });
    expect(listed.result).toBe(0);
    expect(JSON.parse(listed.stdout.join("\n"))).toMatchObject({ target: "cursor" });
  });

  test("install uses the config target when manifest active and detect are absent", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-config-install-"));
    const home = mkdtempSync(join(tmpdir(), "bapm-config-install-home-"));
    project = {
      cwd,
      cleanup: () => {
        rmSync(cwd, { recursive: true, force: true });
        rmSync(home, { recursive: true, force: true });
      },
    };
    linkCursorIntegration(cwd);
    writeProjectText(
      cwd,
      "bapm.yml",
      "name: config-target-install\nversion: 0.0.1\ndependencies:\n  apm: []\n",
    );

    const set = await runInProject(cwd, ["config", "set", "target", "cursor"], { HOME: home });
    expect(set.result).toBe(0);

    const install = await runInProject(cwd, ["install", "--no-frozen", "--no-policy"], {
      HOME: home,
    });
    expect(install.result).toBe(0);
    expect(install.combined).toContain("installed for cursor");
  });
});
