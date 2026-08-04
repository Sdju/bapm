/**
 * M10 HARD: no new bapm-target-* — expected GREEN (cursor-only allow-list).
 * Specs: target-package-architecture. Checklist C §20.
 */
import { expect, test } from "vite-plus/test";
import { listBapmTargetPackageNames } from "./helpers.ts";

test("HARD: workspace bapm-target-* is only api + cursor", () => {
  expect(listBapmTargetPackageNames()).toEqual(["bapm-target-api", "bapm-target-cursor"]);
});
