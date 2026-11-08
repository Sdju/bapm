/**
 * deny must prune already-written host MCP entries (not only withhold next install).
 * Promoted from report state-24-09-2026/deny-does-not-undeploy.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createIsolatedHome,
  readText,
  readUserConfig,
  runInEnv,
  writeText,
  type IsolatedHome,
} from "./approve-deny-helpers.ts";
import { linkCursorIntegration } from "./helpers.ts";
import { createDeny } from "../../src/modules/Deny/index.ts";

function writeDenyPruneProject(cwd: string): void {
  linkCursorIntegration(cwd);
  writeText(
    cwd,
    "dep/apm.yml",
    `name: mcp-dep
version: 0.0.1
dependencies:
  mcp:
    - name: dep-server
      type: stdio
      command: echo
`,
  );
  writeText(
    cwd,
    "bapm.yml",
    `name: deny-prune-root
version: 0.0.1
target: cursor
executables:
  allow:
    mcp-dep:
      mcp: true
dependencies:
  apm:
    - path: ./dep
`,
  );
  mkdirSync(join(cwd, ".cursor"), { recursive: true });
}

function readMcpServers(cwd: string): Record<string, unknown> {
  const path = join(cwd, ".cursor", "mcp.json");
  if (!existsSync(path)) return {};
  const doc = JSON.parse(readFileSync(path, "utf8")) as {
    mcpServers?: Record<string, unknown>;
  };
  return doc.mcpServers ?? {};
}

function writeLock(cwd: string): void {
  writeFileSync(
    join(cwd, "bapm.lock.yaml"),
    `lockfile_version: "1"
dependencies: []
`,
    "utf8",
  );
}

describe("bapm deny prunes host MCP entries", () => {
  let env: IsolatedHome | undefined;

  afterEach(() => {
    env?.cleanup();
    env = undefined;
  });

  test("deny invokes the injected apply step with only: mcp", async () => {
    env = createIsolatedHome();
    writeText(env.cwd, "bapm.yml", "name: injected-deny\nversion: 0.0.1\n");
    writeLock(env.cwd);
    const calls: Array<{ cwd: string; only: string; noPolicy: boolean }> = [];
    const deny = createDeny({
      saveGrant: () => undefined,
      applyDenied: async (options) => {
        calls.push(options);
        return { ok: true };
      },
    });

    const result = await deny.run({ args: ["deny", "mcp-dep"], cwd: env.cwd });
    expect(result.exitCode).toBe(0);
    expect(calls).toEqual([{ cwd: env.cwd, only: "mcp", noPolicy: true }]);
  });

  test("Cursor host config loses the denied server after deny", async () => {
    env = createIsolatedHome();
    writeDenyPruneProject(env.cwd);
    const manifestBefore = readText(join(env.cwd, "bapm.yml"));

    const installed = await runInEnv(env, ["install", "--target", "cursor"]);
    expect(installed.result, installed.combined).toBe(0);
    expect(readMcpServers(env.cwd)).toHaveProperty("dep-server");

    const denied = await runInEnv(env, ["deny", "mcp-dep"]);
    expect(denied.result, denied.combined).toBe(0);
    expect(readUserConfig(env.home).executables?.deny?.["mcp-dep"]).toBeTruthy();
    expect(readMcpServers(env.cwd)).not.toHaveProperty("dep-server");
    expect(readText(join(env.cwd, "bapm.yml"))).toBe(manifestBefore);
  });

  test("no manifest/lock still exits 0 with a manual cleanup hint", async () => {
    env = createIsolatedHome();
    const denied = await runInEnv(env, ["deny", "ghost"]);
    expect(denied.result, denied.combined).toBe(0);
    expect(denied.combined).toMatch(/warning/i);
    expect(denied.combined).toMatch(/manual/i);
  });

  test("deny for a package with no host entry is idempotent", async () => {
    env = createIsolatedHome();
    writeText(env.cwd, "bapm.yml", "name: no-host-entry\nversion: 0.0.1\ntarget: cursor\n");
    writeLock(env.cwd);
    mkdirSync(join(env.cwd, ".cursor"), { recursive: true });
    writeFileSync(
      join(env.cwd, ".cursor", "mcp.json"),
      `${JSON.stringify({ mcpServers: { foreign: { command: "foreign" } } }, null, 2)}\n`,
      "utf8",
    );

    const first = await runInEnv(env, ["deny", "mcp-dep"]);
    const second = await runInEnv(env, ["deny", "mcp-dep"]);
    expect(first.result, first.combined).toBe(0);
    expect(second.result, second.combined).toBe(0);
    expect(readMcpServers(env.cwd)).toEqual({ foreign: { command: "foreign" } });
  });
});
