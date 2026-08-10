/**
 * Unit: dry-run / marketplace none / unknown format.
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

describe("mp-pack-outputs unit dry-run / filter", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("dry-run does not write durable marketplace.json", async () => {
    project = createTempProject();
    writeBapmYml(project.cwd, validLocalAuthoringYml());
    writeText(join(project.cwd, "plugins/demo/README.md"), "# demo\n");
    const build = getBuildMarketplaceOutputs();
    await Promise.resolve(build({ cwd: project.cwd, marketplace: "claude", dryRun: true }));
    expect(existsSync(join(project.cwd, ".claude-plugin/marketplace.json"))).toBe(false);
  });

  test("marketplace none skips write", async () => {
    project = createTempProject();
    writeBapmYml(project.cwd, validLocalAuthoringYml());
    writeText(join(project.cwd, "plugins/demo/README.md"), "# demo\n");
    const build = getBuildMarketplaceOutputs();
    const result = (await Promise.resolve(build({ cwd: project.cwd, marketplace: "none" }))) as {
      skipped?: boolean;
      written?: unknown[];
    };
    expect(result.skipped === true || (result.written?.length ?? 0) === 0).toBe(true);
    expect(existsSync(join(project.cwd, ".claude-plugin/marketplace.json"))).toBe(false);
  });

  test("unknown marketplace format fails closed", async () => {
    project = createTempProject();
    writeBapmYml(project.cwd, validLocalAuthoringYml());
    writeText(join(project.cwd, "plugins/demo/README.md"), "# demo\n");
    const build = getBuildMarketplaceOutputs();
    await expect(
      Promise.resolve(build({ cwd: project.cwd, marketplace: "not-a-host" })),
    ).rejects.toThrow(/not-a-host|unknown.*format|unknown.*marketplace/i);

    const parseFilter = (core as Record<string, unknown>).parseMarketplaceFilter as
      | ((v: string) => unknown)
      | undefined;
    if (parseFilter) {
      expect(() => parseFilter("not-a-host")).toThrow(/not-a-host|unknown/i);
    }
  });
});
