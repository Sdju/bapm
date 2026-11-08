/**
 * Read-only `bapm approve --list/--pending` (P2 approve UX).
 */
import { existsSync } from "node:fs";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createIsolatedHome,
  readUserConfig,
  runInEnv,
  userConfigPath,
  writeMinimalProject,
  writeText,
  type IsolatedHome,
} from "./approve-deny-helpers.ts";
import { fingerprintProject } from "../install/helpers.ts";

const LOCK = `lockfile_version: "1"
dependencies:
  - name: lock-mcp
    repo_url: local:./deps/lock-mcp
    local_path: ./deps/lock-mcp
  - name: lock-bin-hook
    repo_url: local:./deps/lock-bin-hook
    local_path: ./deps/lock-bin-hook
mcp_servers:
  dep-server:
    name: dep-server
    package: lock-mcp
    command: echo
`;

type PendingJson = {
  lockfile: string | null;
  manifest: string | null;
  pending: Array<{ package: string; types: string[]; reason: string }>;
};

type GrantsJson = {
  source: string;
  path: string;
  present: boolean;
  grants: Array<{ package: string; grant: string; types: string[]; source: string }>;
};

function writeExecutableProject(cwd: string): void {
  writeText(
    cwd,
    "bapm.yml",
    `name: pending-root
version: 0.0.1
`,
  );
  writeText(cwd, "bapm.lock.yaml", LOCK);
  writeText(
    cwd,
    "deps/lock-mcp/apm.yml",
    `name: lock-mcp
version: 0.0.1
`,
  );
  writeText(
    cwd,
    "deps/lock-bin-hook/apm.yml",
    `name: lock-bin-hook
version: 0.0.1
`,
  );
  writeText(cwd, "deps/lock-bin-hook/bin/probe", "#!/bin/sh\necho probe\n");
  writeText(cwd, "deps/lock-bin-hook/hooks/guard.json", '{"event":"stop"}\n');
}

function parseJson<T>(stdout: string[]): T {
  return JSON.parse(stdout.join("\n")) as T;
}

describe("CLI approve --list / --pending", () => {
  let env: IsolatedHome | undefined;

  afterEach(() => {
    env?.cleanup();
    env = undefined;
  });

  test("empty config: --list --json returns an empty stable shape", async () => {
    env = createIsolatedHome();
    writeMinimalProject(env.cwd);

    const { result, stdout, stderr } = await runInEnv(env, ["approve", "--list", "--json"]);
    expect(result, stderr.join("\n")).toBe(0);
    const json = parseJson<GrantsJson>(stdout);
    expect(json).toMatchObject({ source: "user", present: false, grants: [] });
    expect(json.path).toBe(userConfigPath(env.home));
    expect(existsSync(userConfigPath(env.home))).toBe(false);
  });

  test("--list shows user-local grants with package, types, allow/deny, source", async () => {
    env = createIsolatedHome();
    writeMinimalProject(env.cwd);

    expect((await runInEnv(env, ["approve", "acme/tools", "--mcp", "--bin"])).result).toBe(0);
    expect((await runInEnv(env, ["deny", "acme/bad", "--hook"])).result).toBe(0);

    const { result, stdout } = await runInEnv(env, ["approve", "--list", "--json"]);
    expect(result).toBe(0);
    const json = parseJson<GrantsJson>(stdout);
    expect(json.present).toBe(true);
    expect(json.grants).toEqual([
      { package: "acme/bad", grant: "deny", types: ["hook"], source: "user" },
      { package: "acme/tools", grant: "allow", types: ["mcp", "bin"], source: "user" },
    ]);
  });

  test("--pending lists lock MCP/bin/hook packages with no decision", async () => {
    env = createIsolatedHome();
    writeExecutableProject(env.cwd);

    const { result, stdout, stderr } = await runInEnv(env, ["approve", "--pending", "--json"]);
    expect(result, stderr.join("\n")).toBe(0);
    const json = parseJson<PendingJson>(stdout);
    expect(json.pending.map((row) => row.package)).toEqual(["lock-bin-hook", "lock-mcp"]);
    expect(json.pending.find((row) => row.package === "lock-bin-hook")?.types).toEqual([
      "bin",
      "hook",
    ]);
    expect(json.pending.find((row) => row.package === "lock-mcp")?.types).toEqual(["mcp"]);
    expect(json.pending[0]?.reason).toMatch(/unapproved|allow or deny/);
  });

  test("--pending skips a package allowed in the project manifest", async () => {
    env = createIsolatedHome();
    writeExecutableProject(env.cwd);
    writeText(
      env.cwd,
      "bapm.yml",
      `name: pending-root
version: 0.0.1
executables:
  allow:
    lock-mcp:
      mcp: true
`,
    );

    const { result, stdout } = await runInEnv(env, ["approve", "--pending", "--json"]);
    expect(result).toBe(0);
    const json = parseJson<PendingJson>(stdout);
    expect(json.pending.map((row) => row.package)).toEqual(["lock-bin-hook"]);
  });

  test("--pending skips a package denied by org policy", async () => {
    env = createIsolatedHome();
    writeExecutableProject(env.cwd);
    writeText(
      env.cwd,
      "bapm-policy.yml",
      `name: org-policy
enforcement: block
executables:
  deny:
    - lock-bin-hook
`,
    );

    const { result, stdout } = await runInEnv(env, ["approve", "--pending", "--json"]);
    expect(result).toBe(0);
    const json = parseJson<PendingJson>(stdout);
    expect(json.pending.map((row) => row.package)).toEqual(["lock-mcp"]);
  });

  test("JSON shapes are stable", async () => {
    env = createIsolatedHome();
    writeExecutableProject(env.cwd);
    await runInEnv(env, ["approve", "acme/tools"]);

    const grants = parseJson<GrantsJson>(
      (await runInEnv(env, ["approve", "--list", "--json"])).stdout,
    );
    expect(Object.keys(grants).sort()).toEqual(["grants", "path", "present", "source"]);
    expect(Object.keys(grants.grants[0]!).sort()).toEqual(["grant", "package", "source", "types"]);

    const pending = parseJson<PendingJson>(
      (await runInEnv(env, ["approve", "--pending", "--json"])).stdout,
    );
    expect(Object.keys(pending).sort()).toEqual(["lockfile", "manifest", "pending"]);
    expect(Object.keys(pending.pending[0]!).sort()).toEqual(["package", "reason", "types"]);
  });

  test("--list and --pending write nothing (project or user config)", async () => {
    env = createIsolatedHome();
    writeExecutableProject(env.cwd);
    const before = fingerprintProject(env.cwd);

    const list = await runInEnv(env, ["approve", "--list"]);
    const pending = await runInEnv(env, ["approve", "--pending"]);
    expect([list.result, pending.result]).toEqual([0, 0]);
    expect(fingerprintProject(env.cwd)).toBe(before);
    expect(existsSync(userConfigPath(env.home))).toBe(false);
    expect(readUserConfig(env.home)).toEqual({});
  });

  test("help documents read-only --list and --pending", async () => {
    env = createIsolatedHome();
    const { result, combined } = await runInEnv(env, ["approve", "--help"]);
    expect(result).toBe(0);
    expect(combined).toMatch(/--list/);
    expect(combined).toMatch(/--pending/);
    expect(combined).toMatch(/read-only/i);
  });

  test("--json without --list/--pending is rejected", async () => {
    env = createIsolatedHome();
    writeMinimalProject(env.cwd);
    const { result, combined } = await runInEnv(env, ["approve", "pkg", "--json"]);
    expect(result).toBe(1);
    expect(combined).toMatch(/--json.*--list.*--pending/i);
  });
});
