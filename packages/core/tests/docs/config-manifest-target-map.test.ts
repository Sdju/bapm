/**
 * Docs: config-manifest covers object-map target / targets.
 * Promoted from manifest-target-integration-map acceptance.
 */
import { describe, expect, test } from "vite-plus/test";
import { configManifestGuidePath, fileExists, readText } from "./helpers.ts";

describe("config-manifest docs — target/targets object-map", () => {
  test("guide exists", () => {
    expect(fileExists(configManifestGuidePath), `expected ${configManifestGuidePath}`).toBe(true);
  });

  test("documents object-map host→package bindings for target/targets", () => {
    const md = readText(configManifestGuidePath);

    // Concrete map example (host key → npm package string), not merely "object-dep".
    expect(
      md,
      "guide must show an object-map example binding a host id to an integration package",
    ).toMatch(
      /(?:target|targets)\s*:\s*[\s\S]{0,80}(?:cursor|claude|codex)\s*:\s*["']?@[\w.-]+\/[\w.-]+/i,
    );
  });

  test("frames object-map target/targets as a bapm extension", () => {
    const md = readText(configManifestGuidePath);

    // Require extension framing tied to target/targets object-map (not marketplace/local).
    const framed =
      /(?:target|targets)[\s\S]{0,500}(?:object[- ]?map|host\s*→|host\s*->|host.?id\s*→)[\s\S]{0,300}(?:bapm[- ]?расширен|bapm extension|расширение bapm)/i.test(
        md,
      ) ||
      /(?:bapm[- ]?расширен|bapm extension|расширение bapm)[\s\S]{0,300}(?:object[- ]?map)[\s\S]{0,200}(?:target|targets)/i.test(
        md,
      ) ||
      /object[- ]?map[\s\S]{0,200}(?:target|targets)[\s\S]{0,200}(?:bapm[- ]?расширен|bapm extension|расширение bapm)/i.test(
        md,
      );

    expect(
      framed,
      "guide must frame object-map target/targets as a bapm extension (near that topic)",
    ).toBe(true);
  });

  test("states map values are not auto-loaded and do not select the active host", () => {
    const md = readText(configManifestGuidePath);

    expect(
      md,
      "guide must say integration package values are not loaded / installed from the map alone",
    ).toMatch(
      /(?:не\s+(?:авто(?:матически)?[- ]?)?(?:загруж|установ|активир)|(?:do\s+not|does\s+not|not)\s+(?:auto-?)?(?:load|install|activat)|без\s+авто[- ]?загруз)/i,
    );

    expect(md, "guide must keep active host selection as --target / detect").toMatch(
      /--target|auto-?detect|detect/i,
    );
  });

  test("prefers targets for multi-host object maps", () => {
    const md = readText(configManifestGuidePath);
    expect(md, "guide should prefer targets for multi-host object maps").toMatch(
      /(?:prefer|предпочт\w*|лучше\s+использовать|рекоменд\w*)[\s\S]{0,80}targets/i,
    );
  });
});
