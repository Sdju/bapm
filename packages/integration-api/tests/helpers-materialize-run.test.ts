import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { createMaterializeRun } from "../src/index.ts";

describe("createMaterializeRun", () => {
  test("resolves cwd, roots, and an empty report", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-run-"));
    const run = createMaterializeRun({
      primitives: [],
      ctx: { cwd, targetId: "test", deployRoots: [] },
      defaultDeployRoots: [".test"],
      targetId: "test",
    });
    expect(run.cwd).toBe(cwd);
    expect(run.roots).toEqual([".test"]);
    expect(run.report()).toEqual({ targetId: "test", deployedFiles: [] });
  });

  test("prefers context roots and checks required roots", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-run-"));
    const run = createMaterializeRun({
      primitives: [],
      ctx: { cwd, targetId: "test", deployRoots: [".nested"] },
      defaultDeployRoots: [".default"],
      targetId: "test",
      requiredRoots: [".nested"],
    });
    expect(run.roots).toEqual([".nested"]);
  });

  test("throws the historical label error for a missing required root", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-run-"));
    expect(() =>
      createMaterializeRun({
        primitives: [],
        ctx: { cwd, targetId: "cursor", deployRoots: [] },
        defaultDeployRoots: [".cursor"],
        targetId: "cursor",
        requiredRoots: [".agents"],
        label: "cursor",
      }),
    ).toThrow("cursor target missing .agents deploy root");
  });

  test("includes diagnostics only when present", () => {
    const cwd = mkdtempSync(join(tmpdir(), "bapm-run-"));
    const run = createMaterializeRun({
      primitives: [],
      ctx: { cwd, targetId: "test", deployRoots: [] },
      defaultDeployRoots: [".test"],
      targetId: "test",
    });
    run.diagnostics.push({ code: "X", message: "note" });
    expect(run.report().diagnostics).toEqual([{ code: "X", message: "note" }]);
  });
});
