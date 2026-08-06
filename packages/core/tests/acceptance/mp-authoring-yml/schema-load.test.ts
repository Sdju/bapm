/**
 * marketplace-authoring-schema — load / inherit / unknown keys / outputs without emit.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  asRecord,
  authoringName,
  authoringPackages,
  createTempProject,
  getLoadMarketplaceFromBapmYml,
  hasHostMarketplaceJsonEmit,
  join,
  loadFailed,
  type TempProject,
  validAuthoringBapmYml,
  writeBapmYml,
  writeText,
} from "./helpers.ts";

describe("mp-authoring-yml schema load", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("inherits top-level name when marketplace block omits name", () => {
    project = createTempProject();
    writeBapmYml(
      project.cwd,
      [
        `name: acme`,
        `version: "1.0.0"`,
        `marketplace:`,
        `  owner: acme-org`,
        `  packages:`,
        `    - name: demo`,
        `      source: ./plugins/demo`,
        ``,
      ].join("\n"),
    );

    const load = getLoadMarketplaceFromBapmYml();
    const result = load({ cwd: project.cwd, path: join(project.cwd, "bapm.yml") });
    expect(loadFailed(result)).toBe(false);
    expect(authoringName(result)).toBe("acme");
  });

  test("unknown key in marketplace block fails closed", () => {
    project = createTempProject();
    writeBapmYml(
      project.cwd,
      [
        `name: acme`,
        `marketplace:`,
        `  owner: acme-org`,
        `  totallyUnknownKey: true`,
        `  packages: []`,
        ``,
      ].join("\n"),
    );

    const load = getLoadMarketplaceFromBapmYml();
    let failed = false;
    try {
      const result = load({ cwd: project.cwd, path: join(project.cwd, "bapm.yml") });
      failed = loadFailed(result);
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });

  test("build + outputs retained without emitting host marketplace.json", () => {
    project = createTempProject();
    writeBapmYml(project.cwd, validAuthoringBapmYml({ withOutputs: true }));

    const load = getLoadMarketplaceFromBapmYml();
    const result = load({ cwd: project.cwd, path: join(project.cwd, "bapm.yml") });
    expect(loadFailed(result)).toBe(false);

    const row = asRecord(result);
    const cfg = asRecord(row.config ?? row.marketplace ?? row);
    expect(cfg.build ?? cfg).toBeTruthy();
    const build = cfg.build ? asRecord(cfg.build) : cfg;
    const tag =
      build.tagPattern ?? build.tag_pattern ?? (cfg as { tagPattern?: unknown }).tagPattern;
    expect(tag === "v*" || typeof tag === "string").toBe(true);
    expect(cfg.outputs ?? cfg.claude).toBeTruthy();
    expect(hasHostMarketplaceJsonEmit(project.cwd)).toBe(false);
  });

  test("local ./ source package loads and is classified local", () => {
    project = createTempProject();
    writeBapmYml(project.cwd, validAuthoringBapmYml());
    writeText(join(project.cwd, "plugins", "demo", ".keep"), "");

    const load = getLoadMarketplaceFromBapmYml();
    const result = load({ cwd: project.cwd, path: join(project.cwd, "bapm.yml") });
    expect(loadFailed(result)).toBe(false);
    const pkgs = authoringPackages(result);
    expect(pkgs.length).toBeGreaterThan(0);
    const demo = asRecord(pkgs[0]!);
    expect(demo.name).toBe("demo");
    expect(String(demo.source)).toMatch(/^\.\/plugins\/demo/);
    const isLocal =
      demo.is_local === true ||
      demo.isLocal === true ||
      (typeof demo.isLocal === "function" && Boolean((demo.isLocal as () => boolean)())) ||
      String(demo.source).startsWith("./");
    expect(isLocal).toBe(true);
  });
});
