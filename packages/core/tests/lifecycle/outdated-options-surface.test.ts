/**
 * RunOutdatedOptions.parallelChecks surface (default 4 / 0 = serial).
 */
import { describe, expect, test } from "vite-plus/test";
import { readOutdatedRunSource, readOutdatedTypesSource } from "./helpers.ts";

describe("outdated options surface", () => {
  test("RunOutdatedOptions includes parallelChecks; default unresolved → 4", () => {
    const types = readOutdatedTypesSource();
    expect(types).toMatch(/\bparallelChecks\??\s*:/);

    const run = readOutdatedRunSource();
    // Defense in depth: undefined/omitted must resolve to APM-aligned default 4.
    expect(run).toMatch(/parallelChecks/);
    expect(run).toMatch(/\?\?\s*4|DEFAULT_PARALLEL_CHECKS|\|\|\s*4/);
  });
});
