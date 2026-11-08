import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCopilotIntegration } from "../../src/createCopilotIntegration.ts";
import { createTempProject, readJson, writeJson } from "../helpers.ts";

type CopilotLspDoc = {
  lspServers?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};

function server(overrides: Record<string, unknown> = {}) {
  return {
    name: "gopls",
    command: "gopls",
    args: ["serve"],
    extensionToLanguage: { ".go": "go" },
    startupTimeout: 12000,
    ...overrides,
  };
}

describe("copilot configureLsp → project .github/lsp.json", () => {
  let cleanup: (() => void) | undefined;
  let cwd: string | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    cwd = undefined;
  });

  test("writes fileExtensions, args default, and warmupTimeoutMs", async () => {
    const project = createTempProject("bapm-copilot-lsp-");
    cleanup = project.cleanup;
    cwd = project.cwd;
    mkdirSync(join(cwd, ".github"), { recursive: true });

    const target = createCopilotIntegration();
    const report = await target.configureLsp!([server()], {
      cwd,
      targetId: "copilot",
    });

    const path = join(cwd, ".github", "lsp.json");
    expect(existsSync(path)).toBe(true);
    expect(report.configPath).toBe(".github/lsp.json");
    const doc = readJson(path) as CopilotLspDoc;
    expect(doc.lspServers?.gopls).toEqual({
      command: "gopls",
      args: ["serve"],
      fileExtensions: { ".go": "go" },
      warmupTimeoutMs: 12000,
    });
    expect(doc.lspServers?.gopls).not.toHaveProperty("extensionToLanguage");
  });

  test("defaults args to an empty list when omitted", async () => {
    const project = createTempProject("bapm-copilot-lsp-args-");
    cleanup = project.cleanup;
    cwd = project.cwd;

    const target = createCopilotIntegration();
    await target.configureLsp!([server({ args: undefined })], { cwd, targetId: "copilot" });

    const doc = readJson(join(cwd, ".github", "lsp.json")) as CopilotLspDoc;
    expect(doc.lspServers?.gopls?.args).toEqual([]);
  });

  test("preserves foreign servers/keys, prunes managed stale, and is idempotent", async () => {
    const project = createTempProject("bapm-copilot-lsp-merge-");
    cleanup = project.cleanup;
    cwd = project.cwd;
    const path = join(cwd, ".github", "lsp.json");
    mkdirSync(join(cwd, ".github"), { recursive: true });
    writeJson(path, {
      custom: "keep-me",
      lspServers: {
        manual: { command: "manual-ls", fileExtensions: { ".x": "x" } },
        old: { command: "old-ls", fileExtensions: { ".y": "y" } },
      },
    });

    const target = createCopilotIntegration();
    await target.configureLsp!([server()], {
      cwd,
      targetId: "copilot",
      managedServers: ["old"],
    });
    const first = readFileSync(path, "utf8");
    const doc = JSON.parse(first) as CopilotLspDoc;
    expect(doc.custom).toBe("keep-me");
    expect(doc.lspServers?.manual).toEqual({
      command: "manual-ls",
      fileExtensions: { ".x": "x" },
    });
    expect(doc.lspServers).not.toHaveProperty("old");
    expect(doc.lspServers).toHaveProperty("gopls");

    await target.configureLsp!([server()], {
      cwd,
      targetId: "copilot",
      managedServers: ["old"],
    });
    expect(readFileSync(path, "utf8")).toBe(first);
  });

  test("rejects malformed JSON instead of overwriting it", async () => {
    const project = createTempProject("bapm-copilot-lsp-invalid-");
    cleanup = project.cleanup;
    cwd = project.cwd;
    const path = join(cwd, ".github", "lsp.json");
    mkdirSync(join(cwd, ".github"), { recursive: true });
    writeFileSync(path, "{not json\n", "utf8");

    const target = createCopilotIntegration();
    await expect(target.configureLsp!([server()], { cwd, targetId: "copilot" })).rejects.toThrow(
      /COPILOT_LSP_INVALID/,
    );
  });
});
