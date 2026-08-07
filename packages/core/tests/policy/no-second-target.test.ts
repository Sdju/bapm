/** M8 HARD: integration package inventory. */
import { expect, test } from "vite-plus/test";
import { listBapmIntegrationPackageNames } from "./helpers.ts";

test("HARD: workspace integrations include API and host packages", () => {
  expect(listBapmIntegrationPackageNames()).toEqual([
    "bapm-integration-api",
    "bapm-integration-claude",
    "bapm-integration-codex",
    "bapm-integration-cursor",
  ]);
});
