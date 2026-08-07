/**
 * G5 / G6 — Install positional intercept + lock provenance write
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  addMarketplace,
  createIsolatedEnv,
  expectKnownCommand,
  hasModules,
  readLockText,
  runInEnv,
  writeEmptyProject,
  writeLocalMarketplace,
  type IsolatedEnv,
} from "./search-install-helpers.ts";

describe("mp-search-install G5/G6 install positional + lock provenance", () => {
  let env: IsolatedEnv | undefined;

  afterEach(() => {
    env?.cleanup();
    env = undefined;
  });

  test("positional demo@local-mp installs modules and writes provenance", async () => {
    env = createIsolatedEnv();
    const { alias, marketplaceRoot, pluginName } = writeLocalMarketplace(env);
    expect((await addMarketplace(env, marketplaceRoot, alias)).result).toBe(0);
    writeEmptyProject(env.cwd);

    const { result, combined } = await runInEnv(env, [
      "install",
      "--target",
      "cursor",
      `${pluginName}@${alias}`,
    ]);
    expectKnownCommand(combined, "install");
    expect(result).toBe(0);
    expect(hasModules(env.cwd)).toBe(true);

    const lock = readLockText(env.cwd);
    expect(lock).toMatch(/discovered_via:\s*local-mp/i);
    expect(lock).toMatch(/marketplace_plugin_name:\s*demo/i);
  });

  test("positional marketplace miss fails non-zero without bare-git success", async () => {
    env = createIsolatedEnv();
    writeEmptyProject(env.cwd);
    const before = readProjectManifest(env.cwd);

    const { result, combined } = await runInEnv(env, ["install", "missing@no-such-market"]);
    expectKnownCommand(combined, "install");
    expect(result).not.toBe(0);
    expect(combined).toMatch(
      /marketplace.*not.?found|plugin.*not.?found|not.?found.*marketplace|unknown marketplace/i,
    );
    expect(hasModules(env.cwd)).toBe(false);
    const after = readProjectManifest(env.cwd);
    expect(after).toBe(before);
    expect(after).not.toMatch(/missing@no-such-market/);
  });
});

function readProjectManifest(cwd: string): string {
  const path = existsSync(join(cwd, "bapm.yml")) ? join(cwd, "bapm.yml") : join(cwd, "apm.yml");
  return readFileSync(path, "utf8");
}
