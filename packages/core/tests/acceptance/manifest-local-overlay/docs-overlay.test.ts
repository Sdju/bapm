/**
 * Docs: personal overlay in config-manifest, quick-start, conformance boundary.
 */
import { describe, expect, test } from "vite-plus/test";
import {
  configManifestGuidePath,
  conformanceGuidePath,
  fileExists,
  quickStartGuidePath,
  readText,
} from "./helpers.ts";

describe("manifest-local-overlay — docs", () => {
  test("config-manifest documents bapm.local.yml allowlist and precedence", () => {
    expect(fileExists(configManifestGuidePath), `expected ${configManifestGuidePath}`).toBe(true);
    const md = readText(configManifestGuidePath);

    expect(md, "must name bapm.local.yml").toMatch(/bapm\.local\.yml/);
    expect(md, "must list allowlisted fields").toMatch(/active/);
    expect(md).toMatch(/targets?/);
    expect(md).toMatch(/\benv\b/i);
    expect(md).toMatch(/registries/i);

    const precedence =
      /(?:CLI|--target|flags?)[\s\S]{0,120}(?:bapm\.local\.yml|local)[\s\S]{0,120}(?:bapm\.yml|apm\.yml|base)/i.test(
        md,
      ) ||
      /(?:приоритет|precedence|priority)[\s\S]{0,200}bapm\.local\.yml/i.test(md);
    expect(precedence, "must document flags → local → base precedence").toBe(true);

    const distinctFromLocalSource =
      /bapm\.local\.yml[\s\S]{0,400}(?:не|not|distinct|отлич|≠|!=)[\s\S]{0,120}(?:local:|source\s+local|зависимост)/i.test(
        md,
      ) ||
      /(?:local:|source\s*[`"]?local)[\s\S]{0,400}bapm\.local\.yml/i.test(md);
    expect(
      distinctFromLocalSource,
      "must distinguish personal overlay from local: dependency source",
    ).toBe(true);
  });

  test("quick-start mentions personal bapm.local.yml overlay", () => {
    expect(fileExists(quickStartGuidePath), `expected ${quickStartGuidePath}`).toBe(true);
    const md = readText(quickStartGuidePath);
    expect(md).toMatch(/bapm\.local\.yml/);
    expect(md).toMatch(/overlay|персональ|личн|personal/i);
  });

  test("conformance / boundary frames overlay as bapm-only (not OpenAPM wire)", () => {
    expect(fileExists(conformanceGuidePath)).toBe(true);
    const md = readText(conformanceGuidePath);
    expect(md).toMatch(/bapm\.local\.yml/);
    const framed =
      /bapm\.local\.yml[\s\S]{0,300}(?:bapm[- ]?only|bapm[- ]?расширен|персональ|personal|intentional|намерен)/i.test(
        md,
      ) ||
      /(?:bapm[- ]?only|intentional|намерен|персональ)[\s\S]{0,300}bapm\.local\.yml/i.test(md);
    expect(framed, "must frame bapm.local.yml as bapm personal overlay extension").toBe(true);
    expect(md).not.toMatch(/OpenAPM[\s\S]{0,80}requires[\s\S]{0,40}bapm\.local\.yml/i);
  });
});
