/**
 * Unit: install dry-run + package-ref / exclude (p6a).
 */
import { expect, test, describe, afterEach } from "vite-plus/test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createFakePorts,
  getCreateRegistry,
  getRegisterTarget,
  getRunInstall,
  importTargetApi,
} from "./helpers.ts";

describe("install dry-run / packageRefs unit", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("dry-run leaves fixture tree unchanged and skips write ports", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-p6a-dry-"));
    mkdirSync(join(cwd, "leaf"), { recursive: true });
    mkdirSync(join(cwd, ".cursor"), { recursive: true });
    writeFileSync(
      join(cwd, "bapm.yml"),
      `name: dry-unit\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n  mcp:\n    - name: s\n      registry: false\n      transport: stdio\n      command: echo\n`,
      "utf8",
    );
    writeFileSync(
      join(cwd, "leaf", "apm.yml"),
      `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );
    const before = readFileSync(join(cwd, "bapm.yml"), "utf8");

    const ports = createFakePorts();
    const api = await importTargetApi();
    const registry = getCreateRegistry(api)();
    let materializeCalls = 0;
    let configureMcpCalls = 0;
    getRegisterTarget(api, registry)({
      id: "cursor",
      deployRoots: [".agents/skills", ".cursor"],
      detect: () => true,
      materialize: async () => {
        materializeCalls += 1;
        return { deployedFiles: [] };
      },
      configureMcp: async () => {
        configureMcpCalls += 1;
        return { configPath: ".cursor/mcp.json", servers: [] };
      },
    });

    const result = (await getRunInstall()({
      cwd,
      dryRun: true,
      packageRefs: ["./extra"],
      forcedTarget: "cursor",
      targetRegistry: registry,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    })) as { ok?: boolean; dryRun?: boolean };

    expect(result).toMatchObject({ ok: true, dryRun: true });
    expect(materializeCalls).toBe(0);
    expect(configureMcpCalls).toBe(0);
    expect(readFileSync(join(cwd, "bapm.yml"), "utf8")).toBe(before);
    expect(existsSync(join(cwd, "apm_modules"))).toBe(false);
  });

  test("package ref add auto-creates manifest when missing", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-p6a-add-"));
    mkdirSync(join(cwd, "extra"), { recursive: true });
    writeFileSync(
      join(cwd, "extra", "apm.yml"),
      `name: extra\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );

    const ports = createFakePorts();
    const api = await importTargetApi();
    const registry = getCreateRegistry(api)();
    getRegisterTarget(api, registry)({
      id: "cursor",
      deployRoots: [".agents/skills", ".cursor"],
      detect: () => true,
      materialize: async () => ({ deployedFiles: [] }),
    });

    const result = await getRunInstall()({
      cwd,
      frozen: false,
      packageRefs: ["./extra"],
      targetRegistry: registry,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });

    expect(result).toMatchObject({ ok: true });
    expect(existsSync(join(cwd, "apm.yml")) || existsSync(join(cwd, "bapm.yml"))).toBe(true);
    const text = existsSync(join(cwd, "apm.yml"))
      ? readFileSync(join(cwd, "apm.yml"), "utf8")
      : readFileSync(join(cwd, "bapm.yml"), "utf8");
    expect(text).toMatch(/\.\/extra|path:\s*\.\/extra/);
  });

  test("frozen × packageRefs rejected", async () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-p6a-frz-"));
    mkdirSync(join(cwd, "leaf"), { recursive: true });
    writeFileSync(
      join(cwd, "bapm.yml"),
      `name: frz\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./leaf\n`,
      "utf8",
    );
    writeFileSync(
      join(cwd, "leaf", "apm.yml"),
      `name: leaf\nversion: 0.0.1\ndependencies:\n  apm: []\n`,
      "utf8",
    );

    const ports = createFakePorts();
    const seeded = await getRunInstall()({
      cwd,
      frozen: false,
      gitRemote: ports.gitRemote,
      tagLister: ports.tagLister,
      downloader: ports.downloader,
    });
    expect(seeded).toMatchObject({ ok: true });

    await expect(
      getRunInstall()({
        cwd,
        frozen: true,
        packageRefs: ["./extra"],
        gitRemote: ports.gitRemote,
        tagLister: ports.tagLister,
        downloader: ports.downloader,
      }),
    ).rejects.toThrow(/frozen|positional|package.?ref|mutat/i);
  });
});
