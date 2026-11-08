/**
 * Interactive bapm approve / deny → user store only; MUST NOT write project yml (sc-010).
 * Promoted from sc-executable-governance acceptance.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync } from "node:fs";
import {
  createIsolatedHome,
  readText,
  readUserConfig,
  runInEnv,
  userConfigPath,
  writeMinimalProject,
  type IsolatedHome,
} from "./approve-deny-helpers.ts";

describe("CLI approve/deny user-local (sc-010)", () => {
  let env: IsolatedHome | undefined;

  afterEach(() => {
    env?.cleanup();
    env = undefined;
  });

  test("approve persists grant under ~/.bapm/config.json and leaves bapm.yml unchanged", async () => {
    env = createIsolatedHome();
    const ymlPath = writeMinimalProject(env.cwd);
    const before = readText(ymlPath);

    const { result, combined } = await runInEnv(env, ["approve", "mcp-dep"]);
    expect(
      /unknown command|not a (?:valid )?command|unrecognized/i.test(combined) && result !== 0,
      `approve must be registered (got exit=${result}):\n${combined}`,
    ).toBe(false);
    expect(result, `approve should succeed:\n${combined}`).toBe(0);

    expect(existsSync(userConfigPath(env.home)), "user config.json must exist").toBe(true);
    const cfg = readUserConfig(env.home);
    expect(cfg.executables?.allow?.["mcp-dep"]).toBeTruthy();

    expect(readText(ymlPath)).toBe(before);
    expect(readText(ymlPath)).not.toMatch(/mcp-dep/);
  });

  test("approve --hook persists a hook grant in the user store", async () => {
    env = createIsolatedHome();
    const ymlPath = writeMinimalProject(env.cwd);
    const before = readText(ymlPath);

    const { result, combined } = await runInEnv(env, ["approve", "hook-dep", "--hook"]);
    expect(result, `approve --hook should succeed:\n${combined}`).toBe(0);

    const cfg = readUserConfig(env.home);
    const entry = cfg.executables?.allow?.["hook-dep"] as Record<string, unknown> | undefined;
    expect(entry?.hook, "hook grant must persist under executables.allow.<pkg>.hook").toBe(true);
    expect(entry?.mcp).toBeUndefined();
    expect(readText(ymlPath)).toBe(before);
  });

  test("approve --bin persists a bin grant (persistent bin consent)", async () => {
    env = createIsolatedHome();
    const ymlPath = writeMinimalProject(env.cwd);
    const before = readText(ymlPath);

    const { result, combined } = await runInEnv(env, ["approve", "bin-dep", "--bin"]);
    expect(result, `approve --bin should succeed:\n${combined}`).toBe(0);

    const cfg = readUserConfig(env.home);
    expect(cfg.executables?.allow?.["bin-dep"]).toMatchObject({ bin: true });
    expect(cfg.executables?.allow?.["bin-dep"]).not.toMatchObject({ mcp: true });
    expect(readText(ymlPath)).toBe(before);
  });

  test("approve without a type flag still persists mcp (compatibility)", async () => {
    env = createIsolatedHome();
    writeMinimalProject(env.cwd);

    const { result } = await runInEnv(env, ["approve", "mcp-compat"]);
    expect(result).toBe(0);

    const cfg = readUserConfig(env.home);
    expect(cfg.executables?.allow?.["mcp-compat"]).toMatchObject({ mcp: true });
  });

  test("deny persists to user store and does not write project bapm.yml", async () => {
    env = createIsolatedHome();
    const ymlPath = writeMinimalProject(env.cwd);
    const before = readText(ymlPath);

    const { result, combined } = await runInEnv(env, ["deny", "mcp-dep"]);
    expect(
      /unknown command|not a (?:valid )?command|unrecognized/i.test(combined) && result !== 0,
      `deny must be registered (got exit=${result}):\n${combined}`,
    ).toBe(false);
    expect(result, `deny should succeed:\n${combined}`).toBe(0);

    const cfg = readUserConfig(env.home);
    expect(cfg.executables?.deny?.["mcp-dep"]).toBeTruthy();
    expect(readText(ymlPath)).toBe(before);
  });

  test("deny --bin persists a bin deny grant", async () => {
    env = createIsolatedHome();
    writeMinimalProject(env.cwd);

    const { result, combined } = await runInEnv(env, ["deny", "bin-dep", "--bin"]);
    expect(result, `deny --bin should succeed:\n${combined}`).toBe(0);

    const cfg = readUserConfig(env.home);
    expect(cfg.executables?.deny?.["bin-dep"]).toMatchObject({ bin: true });
  });
});
