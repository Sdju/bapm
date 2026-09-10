/**
 * marketplace-authoring-schema — typed marketplace.versioning.strategy.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadMarketplaceFromBapmYml } from "@b-apm/core";

function writeBapm(cwd: string, body: string): void {
  writeFileSync(join(cwd, "bapm.yml"), body, "utf8");
}

describe("authoring versioning.strategy typing", () => {
  let cwd: string | undefined;

  afterEach(() => {
    if (cwd) rmSync(cwd, { recursive: true, force: true });
    cwd = undefined;
  });

  test("omit versioning → lockstep", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-ver-omit-"));
    writeBapm(
      cwd,
      [
        `name: mono`,
        `version: "1.0.0"`,
        `marketplace:`,
        `  owner: acme`,
        `  packages: []`,
        ``,
      ].join("\n"),
    );
    const { config } = loadMarketplaceFromBapmYml({ cwd });
    expect(config.versioning?.strategy).toBe("lockstep");
  });

  test("explicit tag_pattern retained", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-ver-tag-"));
    writeBapm(
      cwd,
      [
        `name: mono`,
        `version: "1.0.0"`,
        `marketplace:`,
        `  owner: acme`,
        `  versioning:`,
        `    strategy: tag_pattern`,
        `  build:`,
        `    tagPattern: "{name}-v{version}"`,
        `  packages: []`,
        ``,
      ].join("\n"),
    );
    const { config } = loadMarketplaceFromBapmYml({ cwd });
    expect(config.versioning?.strategy).toBe("tag_pattern");
  });

  test("unknown strategy fails load", () => {
    cwd = mkdtempSync(join(tmpdir(), "bapm-ver-bad-"));
    writeBapm(
      cwd,
      [
        `name: mono`,
        `marketplace:`,
        `  owner: acme`,
        `  versioning:`,
        `    strategy: not-a-real-strategy`,
        `  packages: []`,
        ``,
      ].join("\n"),
    );
    expect(() => loadMarketplaceFromBapmYml({ cwd })).toThrow(
      /strategy|versioning|unknown|invalid/i,
    );
  });
});
