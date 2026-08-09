/**
 * configureMcp → `.gemini/settings.json` mcpServers (Gemini schema, opt-in).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createTempProject, loadGeminiIntegration, readJson, writeJson } from "./helpers.ts";

describe("gemini configureMcp → .gemini/settings.json mcpServers", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test("writes mcpServers stdio entry without required type when .gemini exists", async () => {
    const project = createTempProject("bapm-gemini-mcp-write-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".gemini"), { recursive: true });

    const target = loadGeminiIntegration();
    const report = await target.configureMcp!(
      [
        {
          name: "test-stdio-server",
          transport: "stdio",
          type: "stdio",
          command: "echo",
          args: ["--greeting", "hello"],
        },
      ],
      { cwd: project.cwd, deployRoots: target.deployRoots, targetId: "gemini" },
    );

    const path = join(project.cwd, ".gemini", "settings.json");
    expect(existsSync(path)).toBe(true);
    expect(report.configPath).toMatch(/\.gemini\/settings\.json$/);
    const doc = readJson(path);
    const servers = doc.mcpServers as Record<string, Record<string, unknown>>;
    expect(servers["test-stdio-server"]?.command).toBe("echo");
    expect(servers["test-stdio-server"]?.type).toBeUndefined();
    expect(report.servers ?? []).toContain("test-stdio-server");
  });

  test("http remote uses httpUrl key", async () => {
    const project = createTempProject("bapm-gemini-mcp-http-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".gemini"), { recursive: true });

    const target = loadGeminiIntegration();
    await target.configureMcp!(
      [
        {
          name: "remote-http",
          transport: "streamable-http",
          type: "streamable-http",
          url: "https://example.test/mcp",
        },
      ],
      { cwd: project.cwd, deployRoots: target.deployRoots, targetId: "gemini" },
    );

    const servers = readJson(join(project.cwd, ".gemini", "settings.json")).mcpServers as Record<
      string,
      Record<string, unknown>
    >;
    expect(servers["remote-http"]?.httpUrl).toBe("https://example.test/mcp");
    expect(servers["remote-http"]?.type).toBeUndefined();
  });

  test("skips when .gemini absent and does not create settings", async () => {
    const project = createTempProject("bapm-gemini-mcp-skip-");
    cleanup = project.cleanup;

    const target = loadGeminiIntegration();
    const report = await target.configureMcp!(
      [{ name: "skip-me", transport: "stdio", command: "echo" }],
      { cwd: project.cwd, deployRoots: target.deployRoots, targetId: "gemini" },
    );

    expect(existsSync(join(project.cwd, ".gemini"))).toBe(false);
    expect(report.diagnostics?.length).toBeGreaterThan(0);
    expect(report.servers ?? []).not.toContain("skip-me");
  });

  test("preserves unrelated mcpServers and hooks", async () => {
    const project = createTempProject("bapm-gemini-mcp-preserve-");
    cleanup = project.cleanup;
    mkdirSync(join(project.cwd, ".gemini"), { recursive: true });
    writeJson(join(project.cwd, ".gemini", "settings.json"), {
      hooks: { BeforeTool: [{ command: "./keep.sh" }] },
      mcpServers: { other: { command: "other-bin" } },
    });

    const target = loadGeminiIntegration();
    await target.configureMcp!([{ name: "owned", transport: "stdio", command: "owned-bin" }], {
      cwd: project.cwd,
      deployRoots: target.deployRoots,
      targetId: "gemini",
    });

    const doc = readJson(join(project.cwd, ".gemini", "settings.json"));
    const servers = doc.mcpServers as Record<string, Record<string, unknown>>;
    expect(servers.other?.command).toBe("other-bin");
    expect(servers.owned?.command).toBe("owned-bin");
    expect((doc.hooks as Record<string, unknown>).BeforeTool).toBeTruthy();
  });
});
