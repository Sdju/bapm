/**
 * Acceptance (RED): config-manifest docs cover `active` selection.
 * OpenSpec change: manifest-active-targets
 */
import { describe, expect, test } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { configManifestGuidePath } from "./helpers.ts";

describe("manifest-active-targets docs — config-manifest", () => {
  test("guide exists", () => {
    expect(existsSync(configManifestGuidePath), `expected ${configManifestGuidePath}`).toBe(true);
  });

  test("documents active field and selection priority", () => {
    const md = readFileSync(configManifestGuidePath, "utf8");

    expect(md, "guide must document the active field").toMatch(
      /(?:^|\n)\s*active\s*:|поле\s+`?active`?|`active`/i,
    );

    // Priority: --target → active → detect → fail
    const priority =
      /--target[\s\S]{0,120}active[\s\S]{0,120}(?:detect|auto-?detect)/i.test(md) ||
      /(?:приоритет|priority|порядок)[\s\S]{0,200}--target[\s\S]{0,80}active[\s\S]{0,80}detect/i.test(
        md,
      );

    expect(
      priority,
      "guide must state selection priority --target → active → detect",
    ).toBe(true);
  });

  test("distinguishes active from target/targets and object-map", () => {
    const md = readFileSync(configManifestGuidePath, "utf8");

    expect(
      md,
      "guide must say object-map / target/targets do not by themselves activate hosts",
    ).toMatch(
      /(?:не\s+(?:сам(?:о)?\s+по\s+себе\s+)?активир|(?:do\s+not|does\s+not|not)\s+(?:by\s+themselves\s+)?activat|без\s+`--target`|map\s+сам\s+по\s+себе\s+не\s+активирует)/i,
    );

    expect(md).toMatch(/active/i);
    expect(md).toMatch(/target|targets/i);
  });

  test("notes empty active is rejected and dual-read apm.yml", () => {
    const md = readFileSync(configManifestGuidePath, "utf8");

    expect(
      md,
      "guide must reject / warn about empty active: []",
    ).toMatch(/active\s*:\s*\[\s*\]|пуст\w*\s+active|empty\s+active/i);

    expect(md, "guide must mention dual-read apm.yml / bapm.yml").toMatch(
      /apm\.yml[\s\S]{0,80}bapm\.yml|bapm\.yml[\s\S]{0,80}apm\.yml|dual[- ]?read/i,
    );
  });
});
