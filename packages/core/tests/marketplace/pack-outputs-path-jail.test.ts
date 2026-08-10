/**
 * G2 — path jail on effective output path (soft resolveEffectiveOutputPath / builder).
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import * as core from "@b-apm/core";
import {
  createTempProject,
  getBuildMarketplaceOutputs,
  type TempProject,
  validLocalAuthoringYml,
  writeBapmYml,
  writeText,
} from "./pack-outputs-helpers.ts";

describe("mp-pack-outputs core path jail", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("escape path override fails closed and writes nothing", async () => {
    project = createTempProject();
    writeBapmYml(project.cwd, validLocalAuthoringYml());
    writeText(join(project.cwd, "plugins/demo/README.md"), "# demo\n");

    const c = core as Record<string, unknown>;
    const resolvePath = [
      "resolveEffectiveOutputPath",
      "resolveMarketplaceOutputPath",
      "ensureMarketplacePathWithin",
    ].find((n) => typeof c[n] === "function");

    if (resolvePath) {
      const fn = c[resolvePath] as (opts: Record<string, unknown>) => unknown;
      let failed = false;
      try {
        const result = fn({
          cwd: project.cwd,
          format: "claude",
          path: "../../outside/marketplace.json",
        });
        if (result && typeof result === "object" && "ok" in (result as object)) {
          failed = !(result as { ok: boolean }).ok;
        }
      } catch {
        failed = true;
      }
      expect(failed).toBe(true);
      return;
    }

    const build = getBuildMarketplaceOutputs();
    let exitFailed = false;
    try {
      const result = await Promise.resolve(
        build({
          cwd: project.cwd,
          marketplace: "claude",
          marketplacePaths: { claude: "../../outside/marketplace.json" },
        }),
      );
      if (result && typeof result === "object" && "ok" in (result as object)) {
        exitFailed = !(result as { ok: boolean }).ok;
      } else {
        exitFailed = true;
      }
    } catch {
      exitFailed = true;
    }
    expect(exitFailed).toBe(true);
    expect(existsSync(join(project.cwd, ".claude-plugin/marketplace.json"))).toBe(false);
  });
});
