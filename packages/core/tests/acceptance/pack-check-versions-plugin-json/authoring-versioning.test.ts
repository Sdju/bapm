/**
 * marketplace-authoring-schema — typed marketplace.versioning.strategy for pack gates.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  asRecord,
  buildMarketplaceBapmYml,
  createTempProject,
  effectiveVersioningStrategy,
  getLoadMarketplaceFromBapmYml,
  writeBapmYml,
  writeText,
  join,
  type TempProject,
} from "./helpers.ts";

function stubLocalPackage(cwd: string, rel = "plugins/demo"): void {
  writeText(join(cwd, rel, "README.md"), "# demo\n");
}

describe("pack-check-versions-plugin-json — authoring versioning.strategy", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("omitted versioning defaults effective strategy to lockstep", () => {
    project = createTempProject();
    writeBapmYml(
      project.cwd,
      buildMarketplaceBapmYml({
        withOutputs: false,
        packages: [{ name: "demo", source: "./plugins/demo" }],
      }),
    );
    stubLocalPackage(project.cwd);

    const load = getLoadMarketplaceFromBapmYml();
    const loaded = asRecord(load({ cwd: project.cwd }));
    const config = loaded.config ?? loaded;
    expect(effectiveVersioningStrategy(config)).toBe("lockstep");
  });

  test("explicit tag_pattern strategy is retained", () => {
    project = createTempProject();
    writeBapmYml(
      project.cwd,
      buildMarketplaceBapmYml({
        strategy: "tag_pattern",
        buildTagPattern: "{name}-v{version}",
        withOutputs: false,
      }),
    );
    stubLocalPackage(project.cwd);

    const load = getLoadMarketplaceFromBapmYml();
    const loaded = asRecord(load({ cwd: project.cwd }));
    const config = loaded.config ?? loaded;
    expect(effectiveVersioningStrategy(config)).toBe("tag_pattern");
  });

  test("unknown strategy fails closed at load", () => {
    project = createTempProject();
    writeBapmYml(
      project.cwd,
      buildMarketplaceBapmYml({
        strategy: "not-a-real-strategy",
        withOutputs: false,
      }),
    );
    stubLocalPackage(project.cwd);

    const load = getLoadMarketplaceFromBapmYml();
    expect(() => load({ cwd: project!.cwd })).toThrow(/strategy|versioning|unknown|invalid/i);
  });
});
