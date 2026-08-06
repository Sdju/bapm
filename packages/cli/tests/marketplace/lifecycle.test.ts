/**
 * marketplace-cli-authoring — init → package add → check --offline lifecycle; no pack emit.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownMarketplaceSub,
  hasHostMarketplaceJsonEmit,
  readText,
  runInProject,
  type TempProject,
} from "./authoring-helpers.ts";

describe("mp-authoring-yml CLI lifecycle", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("init → package add --no-verify → check --offline succeeds without pack emit", async () => {
    project = createTempProject();

    const init = await runInProject(project.cwd, [
      "marketplace",
      "init",
      "--name",
      "lifecycle-mp",
      "--owner",
      "acme-org",
    ]);
    expectKnownMarketplaceSub(init.combined, "init");
    expect(init.result).toBe(0);

    const add = await runInProject(project.cwd, [
      "marketplace",
      "package",
      "add",
      "./plugins/local-demo",
      "--name",
      "local-demo",
      "--no-verify",
    ]);
    expectKnownMarketplaceSub(add.combined, "package");
    expect(add.result).toBe(0);

    const check = await runInProject(project.cwd, ["marketplace", "check", "--offline"]);
    expectKnownMarketplaceSub(check.combined, "check");
    expect(check.result).toBe(0);

    const yml = readText(project.cwd, "bapm.yml");
    expect(yml).toMatch(/marketplace:/);
    expect(yml).toMatch(/local-demo/);
    expect(hasHostMarketplaceJsonEmit(project.cwd)).toBe(false);
  });
});
