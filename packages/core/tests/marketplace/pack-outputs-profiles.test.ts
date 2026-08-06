/**
 * Unit: path jail + profile defaults/overrides.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import * as core from "@bapm/core";
import {
  createTempProject,
  getBuildMarketplaceOutputs,
  type TempProject,
  validLocalAuthoringYml,
  writeBapmYml,
  writeText,
} from "./pack-outputs-helpers.ts";

describe("mp-pack-outputs unit profiles / path jail", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("default Claude path under .claude-plugin/marketplace.json", async () => {
    project = createTempProject();
    writeBapmYml(project.cwd, validLocalAuthoringYml());
    writeText(join(project.cwd, "plugins/demo/README.md"), "# demo\n");

    const c = core as Record<string, unknown>;
    const resolvePath = c.resolveEffectiveOutputPath as
      | ((opts: Record<string, unknown>) => string)
      | undefined;
    if (resolvePath) {
      const path = resolvePath({ cwd: project.cwd, format: "claude" });
      expect(path.replace(/\\/g, "/")).toMatch(/\.claude-plugin\/marketplace\.json$/);
      return;
    }

    const build = getBuildMarketplaceOutputs();
    await Promise.resolve(build({ cwd: project.cwd, marketplace: "claude" }));
    expect(
      (await import("node:fs")).existsSync(join(project.cwd, ".claude-plugin/marketplace.json")),
    ).toBe(true);
  });

  test("CLI path override confined under project root", async () => {
    project = createTempProject();
    writeBapmYml(project.cwd, validLocalAuthoringYml());
    writeText(join(project.cwd, "plugins/demo/README.md"), "# demo\n");

    const build = getBuildMarketplaceOutputs();
    await Promise.resolve(
      build({
        cwd: project.cwd,
        marketplace: "claude",
        marketplacePaths: { claude: "nested/out/marketplace.json" },
      }),
    );
    expect(
      (await import("node:fs")).existsSync(join(project.cwd, "nested/out/marketplace.json")),
    ).toBe(true);
  });

  test("path escape fails closed", () => {
    project = createTempProject();
    const c = core as Record<string, unknown>;
    const resolvePath = c.resolveEffectiveOutputPath as
      | ((opts: Record<string, unknown>) => string)
      | undefined;
    expect(resolvePath).toBeTypeOf("function");
    expect(() =>
      resolvePath!({
        cwd: project!.cwd,
        format: "claude",
        path: "../../outside/marketplace.json",
      }),
    ).toThrow(/jail|escape|project root|within|path/i);
  });
});
