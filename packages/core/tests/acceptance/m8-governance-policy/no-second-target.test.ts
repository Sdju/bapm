/**
 * M8 HARD: no second bapm-target-* — expected GREEN before apply.
 */
import { expect, test } from "vite-plus/test";
import { listBapmTargetPackageNames } from "./helpers.ts";

test("HARD: workspace bapm-target-* is only api + cursor", () => {
  expect(listBapmTargetPackageNames()).toEqual(["bapm-target-api", "bapm-target-cursor"]);
});
