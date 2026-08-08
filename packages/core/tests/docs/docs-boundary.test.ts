/**
 * Docs OpenAPM boundary — docs/link presence (promoted from p5-docs-openapm-boundary).
 */
import { expect, test } from "vite-plus/test";
import {
  conformanceGuidePath,
  docsArchitecturePath,
  docsGuideIndexPath,
  docsLandingPath,
  docsRoot,
  fileExists,
  readText,
  vitepressConfigPath,
} from "./helpers.ts";
import { join } from "node:path";

const supportedHostsPath = join(docsRoot, "guide/supported-hosts.md");

test("dedicated VitePress guide/conformance.md exists and is navigable from sidebar", () => {
  expect(fileExists(conformanceGuidePath), "apps/docs/guide/conformance.md must exist").toBe(true);
  const config = readText(vitepressConfigPath);
  expect(config).toMatch(/\/guide\/conformance/);
});

test("conformance guide states three axes and links root CONFORMANCE.md", () => {
  expect(fileExists(conformanceGuidePath)).toBe(true);
  const page = readText(conformanceGuidePath);
  expect(page).toMatch(/OpenAPM/i);
  expect(page).toMatch(/APM\s+product\s+CLI|microsoft\/apm|product\s+CLI/i);
  expect(page).toMatch(/@bapm\/integration-cursor|built-in|Cursor/i);
  expect(page).toMatch(/object-map|targets:|custom/i);
  expect(page).toMatch(/CONFORMANCE\.md/);
});

test("conformance guide lists out-of-scope aligned with Limitations", () => {
  expect(fileExists(conformanceGuidePath)).toBe(true);
  const page = readText(conformanceGuidePath);
  expect(page).toMatch(/multi-target/i);
  expect(page).toMatch(/marketplace|plugin/i);
  expect(page).toMatch(/registry\s+host/i);
  // Honesty: OOS is built-in matrix, not a denial of custom integrations via object-map.
  expect(page).toMatch(/object-map|targets:|кастомн|custom/i);
});

test("docs landing must not advertise multi-client adapters as shipped", () => {
  const landing = readText(docsLandingPath);
  const advertisesShippedMultiClient =
    /\b(Copilot|Claude)\b/i.test(landing) &&
    !/(out\s+of\s+scope|later|not\s+shipped|future|marketplace|не runtime)/i.test(landing);
  expect(
    advertisesShippedMultiClient,
    "landing must not list Copilot/Claude as current shipped adapters without qualifier",
  ).toBe(false);
  expect(landing).toMatch(/@bapm\/integration|supported-hosts|Cursor/i);
});

test("guide intro must not claim across-clients as bare shipped fact", () => {
  const intro = readText(docsGuideIndexPath);
  const acrossClientsBare =
    /across\s+clients/i.test(intro) &&
    !/(supported-hosts|targets:|object-map|из коробки|built-in)/i.test(intro);
  expect(
    acrossClientsBare,
    'guide intro must not say "across clients" as current fact without host qualifier',
  ).toBe(false);
});

test("supported-hosts guide exists and is navigable", () => {
  expect(fileExists(supportedHostsPath), "apps/docs/guide/supported-hosts.md must exist").toBe(true);
  const config = readText(vitepressConfigPath);
  expect(config).toMatch(/\/guide\/supported-hosts/);
  const page = readText(supportedHostsPath);
  expect(page).toMatch(/createIntegration/i);
  expect(page).toMatch(/targets:/);
  expect(page).toMatch(/@bapm\/integration/);
});

test("architecture overview describes integration packages, not in-tree multi-client adapters in @bapm/core", () => {
  const arch = readText(docsArchitecturePath);
  expect(arch).toMatch(/integration\s+packages|@bapm\/integration/i);
  expect(arch).not.toMatch(/@bapm\/core[^\n]*adapters|install,\s*adapters/i);
  expect(arch).toMatch(/guide\/conformance|\/guide\/conformance/);
  expect(arch).toMatch(/supported-hosts|object-map|createIntegration/i);
});
