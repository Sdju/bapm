/**
 * M10 MUST: help lists publish + self-update; HARD no second target.
 * Specs: cli-runtime-surface, target-package-architecture. Checklist C §19–20.
 */
import { expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  listBapmTargetPackageNames,
  runInProject,
} from "./helpers.ts";

test("help lists publish and self-update", async () => {
  const project = createTempProject();
  try {
    const { result, combined } = await runInProject(project.cwd, ["help"]);
    expect(result).toBe(0);
    expect(combined).toMatch(/\bpublish\b/i);
    expect(combined).toMatch(/\bself-update\b/i);
    expectKnownCommand(combined, "help");
  } finally {
    project.cleanup();
  }
});

test("HARD: workspace bapm-target-* is only api + cursor", () => {
  expect(listBapmTargetPackageNames()).toEqual(["bapm-target-api", "bapm-target-cursor"]);
});
