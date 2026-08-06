/**
 * G2 — interactive bapm approve / deny → user store only; MUST NOT write project yml (sc-010).
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
} from "./helpers.ts";

describe("sc-executable-governance CLI approve/deny user-local (G2)", () => {
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
});
