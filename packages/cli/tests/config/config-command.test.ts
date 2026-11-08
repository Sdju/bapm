/**
 * `bapm config` — user defaults in ~/.bapm/config.json with grant preservation.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
