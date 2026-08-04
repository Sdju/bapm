/**
 * M9 HARD: no second bapm-target-* — invariant (expected GREEN before apply).
 * Specs: target-package-architecture. Checklist D §20.
 */
import { expect, test } from "vite-plus/test";
import { listBapmTargetPackageNames } from "./helpers.ts";

test("HARD: workspace bapm-target-* is only api + cursor", () => {
  expect(listBapmTargetPackageNames()).toEqual(["bapm-target-api", "bapm-target-cursor"]);
});
