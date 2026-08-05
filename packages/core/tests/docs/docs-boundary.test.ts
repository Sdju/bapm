/**
 * Docs OpenAPM boundary — docs/link presence (promoted from p5-docs-openapm-boundary).
 */
import { expect, test } from "vite-plus/test";
import {
  conformanceGuidePath,
  docsArchitecturePath,
  docsGuideIndexPath,
  docsLandingPath,
  fileExists,
  readmePath,
  readText,
  sectionUnderH2,
  vitepressConfigPath,
} from "./helpers.ts";

const SECTION = "Conformance & parity";

test("root README has Conformance & parity section linking CONFORMANCE.md with claimed classes", () => {
  const readme = readText(readmePath);
  const section = sectionUnderH2(readme, SECTION);
  expect(section, `missing ## ${SECTION} in root README`).toBeDefined();
  expect(section!).toMatch(/CONFORMANCE\.md/);
  expect(section!).toMatch(/Consumer/i);
  expect(section!).toMatch(/Producer/i);
  expect(section!).toMatch(/Governance/i);
  expect(section!).toMatch(/Registry\s+N\/A/i);
});

test("README Conformance & parity denies drop-in APM CLI parity", () => {
  const section = sectionUnderH2(readText(readmePath), SECTION);
  expect(section, `missing ## ${SECTION}`).toBeDefined();
  expect(section!).toMatch(/not\s+a\s+drop-in/i);
  expect(section!).toMatch(/microsoft\/apm|APM\s+CLI/i);
});

test("README Conformance & parity lists intentional diffs", () => {
  const section = sectionUnderH2(readText(readmePath), SECTION);
  expect(section, `missing ## ${SECTION}`).toBeDefined();
  expect(section!).toMatch(/∩-pick|intersection.?pick|∩.?pick/i);
  expect(section!).toMatch(/first-wins/i);
  expect(section!).toMatch(/cursor-only/i);
  expect(section!).toMatch(/dual-read/i);
});

test("dedicated VitePress guide/conformance.md exists and is navigable from sidebar", () => {
  expect(
    fileExists(conformanceGuidePath),
    "apps/docs/guide/conformance.md must exist",
  ).toBe(true);
  const config = readText(vitepressConfigPath);
  expect(config).toMatch(/\/guide\/conformance/);
});

test("conformance guide states three axes and links root CONFORMANCE.md", () => {
  expect(fileExists(conformanceGuidePath)).toBe(true);
  const page = readText(conformanceGuidePath);
  expect(page).toMatch(/OpenAPM/i);
  expect(page).toMatch(/APM\s+product\s+CLI|microsoft\/apm|product\s+CLI/i);
  expect(page).toMatch(/cursor-only/i);
  expect(page).toMatch(/CONFORMANCE\.md/);
});

test("conformance guide lists out-of-scope aligned with Limitations", () => {
  expect(fileExists(conformanceGuidePath)).toBe(true);
  const page = readText(conformanceGuidePath);
  expect(page).toMatch(/multi-target/i);
  expect(page).toMatch(/marketplace|plugin/i);
  expect(page).toMatch(/registry\s+host/i);
});

test("docs landing must not advertise multi-client adapters as shipped", () => {
  const landing = readText(docsLandingPath);
  const advertisesShippedMultiClient =
    /\b(Copilot|Claude)\b/i.test(landing) &&
    !/(out\s+of\s+scope|later|not\s+shipped|future)/i.test(landing);
  expect(
    advertisesShippedMultiClient,
    "landing must not list Copilot/Claude as current shipped adapters without out-of-scope/later qualifier",
  ).toBe(false);
  expect(landing).toMatch(/cursor-only|target\s+packages|bapm-target/i);
});

test("guide intro must not claim across-clients without cursor-only qualifier", () => {
  const intro = readText(docsGuideIndexPath);
  const acrossClientsBare =
    /across\s+clients/i.test(intro) && !/cursor-only/i.test(intro);
  expect(
    acrossClientsBare,
    'guide intro must not say "across clients" as current fact without cursor-only',
  ).toBe(false);
});

test("architecture overview describes target packages / cursor-only, not in-tree multi-client adapters in @bapm/core", () => {
  const arch = readText(docsArchitecturePath);
  expect(arch).toMatch(/target\s+packages|bapm-target|cursor-only/i);
  expect(arch).not.toMatch(
    /@bapm\/core[^\n]*adapters|install,\s*adapters/i,
  );
  expect(arch).toMatch(/guide\/conformance|\/guide\/conformance/);
});
