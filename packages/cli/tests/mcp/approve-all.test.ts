/**
 * `bapm approve --all/--recommended` (P2 approve UX).
 *
 * Bulk-approves every currently pending dependency executable package into the
 * user-local store. Writes only `~/.bapm/config.json`; never project `bapm.yml`.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
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
import { createApprove } from "../../src/modules/Approve/index.ts";
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

type AllPlanJson = {
  mode: "all" | "recommended";
  wrote: boolean;
  configPath: string;
  lockfile: string | null;
  manifest: string | null;
  plan: Array<{ package: string; types: string[] }>;
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

describe("CLI approve --all / --recommended", () => {
  let env: IsolatedHome | undefined;

  afterEach(() => {
    env?.cleanup();
    env = undefined;
  });

  test("--pending list and --all --json plan agree (no implicit write)", async () => {
    env = createIsolatedHome();
    writeExecutableProject(env.cwd);

    const pending = parseJson<PendingJson>(
      (await runInEnv(env, ["approve", "--pending", "--json"])).stdout,
    );
    const { result, stdout, stderr } = await runInEnv(env, ["approve", "--all", "--json"]);
    expect(result, stderr.join("\n")).toBe(0);
    const plan = parseJson<AllPlanJson>(stdout);

    expect(plan.mode).toBe("all");
    expect(plan.wrote).toBe(false);
    expect(plan.configPath).toBe(userConfigPath(env.home));
    expect(plan.plan).toEqual(
      pending.pending.map(({ package: name, types }) => ({ package: name, types })),
    );
    expect(existsSync(userConfigPath(env.home))).toBe(false);
  });

  test("--recommended is an alias for --all", async () => {
    env = createIsolatedHome();
    writeExecutableProject(env.cwd);

    const { result, stdout } = await runInEnv(env, ["approve", "--recommended", "--json"]);
    expect(result).toBe(0);
    const plan = parseJson<AllPlanJson>(stdout);
    expect(plan.mode).toBe("recommended");
    expect(plan.wrote).toBe(false);
    expect(plan.plan.map((row) => row.package)).toEqual(["lock-bin-hook", "lock-mcp"]);
    expect(existsSync(userConfigPath(env.home))).toBe(false);
  });

  test("-y writes allow grants for every pending type and leaves bapm.yml untouched", async () => {
    env = createIsolatedHome();
    writeExecutableProject(env.cwd);
    const manifestBefore = fingerprintProject(env.cwd);

    const { result, combined } = await runInEnv(env, ["approve", "--all", "-y"]);
    expect(result, combined).toBe(0);

    const cfg = readUserConfig(env.home);
    expect(cfg.executables?.allow?.["lock-mcp"]).toMatchObject({ mcp: true });
    expect(cfg.executables?.allow?.["lock-bin-hook"]).toMatchObject({ bin: true, hook: true });
    expect(fingerprintProject(env.cwd)).toBe(manifestBefore);
  });

  test("non-interactive --all without -y refuses and writes nothing", async () => {
    env = createIsolatedHome();
    writeExecutableProject(env.cwd);

    const { result, combined } = await runInEnv(env, ["approve", "--all"]);
    expect(result).toBe(1);
    expect(combined).toMatch(/-y\/--yes/);
    expect(existsSync(userConfigPath(env.home))).toBe(false);
  });

  test("no pending packages is a no-op", async () => {
    env = createIsolatedHome();
    writeMinimalProject(env.cwd);

    const { result, combined } = await runInEnv(env, ["approve", "--all", "-y"]);
    expect(result, combined).toBe(0);
    expect(combined).toMatch(/no pending executable packages/i);
    expect(existsSync(userConfigPath(env.home))).toBe(false);
  });

  test("existing deny and existing allow types are preserved", async () => {
    env = createIsolatedHome();
    writeExecutableProject(env.cwd);
    writeText(
      env.home,
      ".bapm/config.json",
      `${JSON.stringify(
        {
          executables: {
            allow: { "lock-bin-hook": { bin: true } },
            deny: { "lock-mcp": { mcp: true } },
          },
        },
        null,
        2,
      )}\n`,
    );

    const { result, combined } = await runInEnv(env, ["approve", "--all", "-y"]);
    expect(result, combined).toBe(0);

    const cfg = readUserConfig(env.home);
    expect(cfg.executables?.deny?.["lock-mcp"]).toMatchObject({ mcp: true });
    expect(cfg.executables?.allow?.["lock-mcp"]).toBeUndefined();
    expect(cfg.executables?.allow?.["lock-bin-hook"]).toMatchObject({ bin: true, hook: true });
  });

  test("--all --json -y writes and reports wrote: true", async () => {
    env = createIsolatedHome();
    writeExecutableProject(env.cwd);
    const manifestBefore = fingerprintProject(env.cwd);

    const { result, stdout } = await runInEnv(env, ["approve", "--all", "--json", "-y"]);
    expect(result).toBe(0);
    const plan = parseJson<AllPlanJson>(stdout);
    expect(plan.wrote).toBe(true);
    expect(plan.plan.map((row) => row.package)).toEqual(["lock-bin-hook", "lock-mcp"]);
    expect(readUserConfig(env.home).executables?.allow?.["lock-mcp"]).toMatchObject({ mcp: true });
    expect(fingerprintProject(env.cwd)).toBe(manifestBefore);
  });

  test("TTY confirmation: accepting writes, declining does not", async () => {
    env = createIsolatedHome();
    writeExecutableProject(env.cwd);
    const configRoot = join(env.home, ".bapm");

    const prompts: string[] = [];
    const accepted = createApprove({
      configRoot,
      isTTY: () => true,
      confirm: async (message) => {
        prompts.push(message);
        return true;
      },
    });
    const acceptedResult = await accepted.run({ args: ["--all"], cwd: env.cwd });
    expect(acceptedResult.ok).toBe(true);
    expect(acceptedResult.exitCode).toBe(0);
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatch(/Approve 2 package\(s\)/);
    expect(readUserConfig(env.home).executables?.allow?.["lock-bin-hook"]).toMatchObject({
      bin: true,
      hook: true,
    });

    const declineEnv = createIsolatedHome("bapm-approve-all-decline-");
    try {
      writeExecutableProject(declineEnv.cwd);
      const declined = createApprove({
        configRoot: join(declineEnv.home, ".bapm"),
        isTTY: () => true,
        confirm: async () => false,
      });
      const declinedResult = await declined.run({ args: ["--all"], cwd: declineEnv.cwd });
      expect(declinedResult.ok).toBe(false);
      expect(declinedResult.exitCode).toBe(1);
      expect(existsSync(userConfigPath(declineEnv.home))).toBe(false);
    } finally {
      declineEnv.cleanup();
    }
  });

  test("--all conflicts with a package name and with --pending/--list", async () => {
    env = createIsolatedHome();
    writeMinimalProject(env.cwd);

    for (const argv of [
      ["approve", "some-pkg", "--all"],
      ["approve", "--all", "--pending"],
      ["approve", "--all", "--list"],
    ]) {
      const { result, combined } = await runInEnv(env, argv);
      expect(result, combined).toBe(1);
      expect(combined).toMatch(/--all|--recommended/);
    }
  });

  test("-y without --all is rejected", async () => {
    env = createIsolatedHome();
    writeMinimalProject(env.cwd);
    const { result, combined } = await runInEnv(env, ["approve", "pkg", "-y"]);
    expect(result).toBe(1);
    expect(combined).toMatch(/-y\/--yes.*--all/);
  });
});
