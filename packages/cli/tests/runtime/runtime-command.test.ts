/**
 * `bapm runtime` — read-only APM runtime list/status parity.
 */
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { createRuntime, type RuntimeRow } from "../../src/modules/Runtime/index.ts";
import { runInProject, withCapturedIo } from "../lifecycle/helpers.ts";

type Fixture = {
  root: string;
  cwd: string;
  home: string;
  bin: string;
  managed: string;
  cleanup: () => void;
};

function createFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "bapm-runtime-cli-"));
  const cwd = join(root, "project");
  const home = join(root, "home");
  const bin = join(root, "bin");
  const managed = join(root, "managed");
  for (const dir of [cwd, home, bin, managed]) mkdirSync(dir, { recursive: true });
  return {
    root,
    cwd,
    home,
    bin,
    managed,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function envFor(fixture: Fixture): Record<string, string> {
  return {
    HOME: fixture.home,
    USERPROFILE: fixture.home,
    BAPM_RUNTIME_DIR: fixture.managed,
    PATH: fixture.bin,
  };
}

function writeFakeBinary(dir: string, name: string, version: string): string {
  const path = join(dir, name);
  writeFileSync(path, `#!/bin/sh\nprintf '%s\\n' '${name} ${version}'\n`, { mode: 0o755 });
  chmodSync(path, 0o755);
  return path;
}

function parseRows(stdout: string[]): RuntimeRow[] {
  return JSON.parse(stdout.join("\n")) as RuntimeRow[];
}

describe("bapm runtime CLI", () => {
  let fixture: Fixture | undefined;

  afterEach(() => {
    fixture?.cleanup();
    fixture = undefined;
  });

  test("list --json reports known runtimes, preference order, paths and versions", async () => {
    fixture = createFixture();
    writeFakeBinary(fixture.managed, "codex", "0.20.0");
    writeFakeBinary(fixture.bin, "gemini", "2.0.0");

    const { result, stdout, stderr } = await runInProject(
      fixture.cwd,
      ["runtime", "list", "--json"],
      envFor(fixture),
    );

    expect(result).toBe(0);
    expect(stderr.join("\n")).toBe("");
    const rows = parseRows(stdout);
    expect(rows.map((row) => row.name)).toEqual(["copilot", "codex", "gemini", "llm"]);
    expect(rows.find((row) => row.name === "codex")).toMatchObject({
      available: true,
      source: "runtime",
      version: "codex 0.20.0",
    });
    expect(rows.find((row) => row.name === "gemini")).toMatchObject({
      available: true,
      source: "path",
      version: "gemini 2.0.0",
    });
    expect(rows.find((row) => row.name === "copilot")).toMatchObject({
      available: false,
      source: null,
      path: null,
      version: null,
    });
  });

  test("list table shows installed and missing runtimes with source", async () => {
    fixture = createFixture();
    writeFakeBinary(fixture.bin, "llm", "0.25.0");

    const { result, stdout } = await runInProject(
      fixture.cwd,
      ["runtime", "list"],
      envFor(fixture),
    );

    expect(result).toBe(0);
    const text = stdout.join("\n");
    expect(text).toMatch(/STATUS\s+RUNTIME\s+SOURCE\s+VERSION\s+PATH\s+DESCRIPTION/);
    expect(text).toMatch(/installed\s+llm\s+path\s+llm 0\.25\.0/);
    expect(text).toMatch(/not installed\s+copilot/);
  });

  test("status NAME --json details one runtime and marks it active", async () => {
    fixture = createFixture();
    writeFakeBinary(fixture.managed, "codex", "0.20.0");

    const { result, stdout } = await runInProject(
      fixture.cwd,
      ["runtime", "status", "codex", "--json"],
      envFor(fixture),
    );

    expect(result).toBe(0);
    expect(JSON.parse(stdout.join("\n"))).toMatchObject({
      name: "codex",
      available: true,
      source: "runtime",
      version: "codex 0.20.0",
      active: true,
      preferenceOrder: ["copilot", "codex", "gemini", "llm"],
    });
  });

  test("status without NAME reports preference order and active runtime", async () => {
    fixture = createFixture();
    writeFakeBinary(fixture.bin, "gemini", "2.0.0");

    const { result, stdout } = await runInProject(
      fixture.cwd,
      ["runtime", "status", "--json"],
      envFor(fixture),
    );

    expect(result).toBe(0);
    expect(JSON.parse(stdout.join("\n"))).toMatchObject({
      active: "gemini",
      preferenceOrder: ["copilot", "codex", "gemini", "llm"],
    });
  });

  test("status unknown runtime exits non-zero with known ids", async () => {
    fixture = createFixture();

    const { result, stdout, stderr } = await runInProject(
      fixture.cwd,
      ["runtime", "status", "pixie"],
      envFor(fixture),
    );

    expect(result).toBe(1);
    expect(stdout.join("\n")).toBe("");
    expect(stderr.join("\n")).toMatch(/Unknown runtime "pixie"/);
    expect(stderr.join("\n")).toMatch(/copilot, codex, gemini, llm/);
  });

  test("injected detection reports a present binary without touching PATH", async () => {
    const runtime = createRuntime({
      runtimeDirs: [],
      env: { PATH: "" },
      which: (binary) => (binary === "copilot" ? "/injected/copilot" : undefined),
      readVersion: () => "9.9.9",
    });

    const { result, stdout } = await withCapturedIo(() =>
      runtime.run({ args: ["list", "--json"] }),
    );

    expect(result.exitCode).toBe(0);
    const rows = parseRows(stdout);
    expect(rows.find((row) => row.name === "copilot")).toMatchObject({
      available: true,
      source: "path",
      path: "/injected/copilot",
      version: "9.9.9",
    });
    expect(rows.find((row) => row.name === "codex")).toMatchObject({
      available: false,
      source: null,
      path: null,
      version: null,
    });
  });

  test("injected detection reports absent binaries and skips version probing", async () => {
    const probed: string[] = [];
    const runtime = createRuntime({
      runtimeDirs: [],
      which: (binary) => {
        probed.push(binary);
        return undefined;
      },
      readVersion: () => {
        throw new Error("version probe must not run for absent binaries");
      },
    });

    expect(runtime.list().every((row) => !row.available)).toBe(true);
    expect(probed).toEqual(["copilot", "codex", "gemini", "llm"]);
  });

  test("setup and remove are explicitly unsupported (exit 1, no fake install)", async () => {
    fixture = createFixture();

    for (const command of ["setup", "remove"] as const) {
      const { result, stdout, stderr } = await runInProject(
        fixture.cwd,
        ["runtime", command, "copilot"],
        envFor(fixture),
      );
      expect(result).toBe(1);
      expect(stdout.join("\n")).toBe("");
      expect(stderr.join("\n")).toMatch(
        new RegExp(`runtime ${command} is not implemented \\(deferred\\)`),
      );
      expect(stderr.join("\n")).toMatch(/read-only/);
    }
  });

  test("runtime help is read-only and marks setup/remove deferred", async () => {
    fixture = createFixture();

    const { result, stdout } = await runInProject(
      fixture.cwd,
      ["runtime", "--help"],
      envFor(fixture),
    );

    expect(result).toBe(0);
    const text = stdout.join("\n");
    expect(text).toMatch(/runtime list/);
    expect(text).toMatch(/runtime status/);
    expect(text).toMatch(/setup/);
    expect(text).toMatch(/remove/);
    expect(text).toMatch(/not implemented|deferred/i);
  });
});
