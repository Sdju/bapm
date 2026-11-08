/**
 * `bapm pack --check-clean` — read-only marketplace drift gate (APM exit 4).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  copilotMarketplacePath,
  createTempProject,
  expectKnownCommand,
  findZipUnder,
  runInProject,
  type TempProject,
  writeConformingManifest,
  writeCopilotLocalAuthoring,
  writeText,
} from "./pack-outputs-helpers.ts";

describe("CLI pack --check-clean", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("passes on a clean working tree without writing artifacts", async () => {
    project = createTempProject();
    writeCopilotLocalAuthoring(project.cwd);
    const first = await runInProject(project.cwd, ["pack", "--marketplace", "copilot"]);
    expect(first.result).toBe(0);
    const before = readFileSync(copilotMarketplacePath(project.cwd), "utf8");

    const { result, combined } = await runInProject(project.cwd, ["pack", "--check-clean"]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(0);
    expect(readFileSync(copilotMarketplacePath(project.cwd), "utf8")).toBe(before);
    expect(findZipUnder(project.cwd)).toBeUndefined();
    expect(combined).toMatch(/drift OK|read-only/i);

    // Comparison is semantic: whitespace-only reformatting is not drift.
    const doc = JSON.parse(before) as Record<string, unknown>;
    writeFileSync(copilotMarketplacePath(project.cwd), JSON.stringify(doc), "utf8");
    const reformatted = await runInProject(project.cwd, ["pack", "--check-clean"]);
    expect(reformatted.result).toBe(0);
  });

  test("detects drift after the committed marketplace.json is edited", async () => {
    project = createTempProject();
    writeCopilotLocalAuthoring(project.cwd);
    await runInProject(project.cwd, ["pack", "--marketplace", "copilot"]);
    const path = copilotMarketplacePath(project.cwd);
    writeFileSync(path, JSON.stringify({ name: "stale" }, null, 2) + "\n", "utf8");

    const { result, combined } = await runInProject(project.cwd, ["pack", "--check-clean"]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(4);
    expect(combined).toMatch(/drift|difference/i);
    expect(readFileSync(path, "utf8")).toContain('"stale"');
  });

  test("reports missing marketplace.json as drift and does not create it", async () => {
    project = createTempProject();
    writeCopilotLocalAuthoring(project.cwd);

    const { result, combined } = await runInProject(project.cwd, ["pack", "--check-clean"]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(4);
    expect(combined).toMatch(/missing on disk/i);
    expect(existsSync(copilotMarketplacePath(project.cwd))).toBe(false);
  });

  test("skips cleanly when there is no marketplace block", async () => {
    project = createTempProject();
    writeConformingManifest(project.cwd);

    const { result, combined } = await runInProject(project.cwd, ["pack", "--check-clean"]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(0);
    expect(combined).toMatch(/drift check skipped/i);
    expect(findZipUnder(project.cwd)).toBeUndefined();
  });

  test("honors --marketplace-path when comparing drift", async () => {
    project = createTempProject();
    writeCopilotLocalAuthoring(project.cwd);
    const pack = await runInProject(project.cwd, [
      "pack",
      "--marketplace",
      "copilot",
      "--marketplace-path",
      "copilot=nested/marketplace.json",
    ]);
    expect(pack.result).toBe(0);

    const clean = await runInProject(project.cwd, [
      "pack",
      "--check-clean",
      "--marketplace-path",
      "copilot=nested/marketplace.json",
    ]);
    expectKnownCommand(clean.combined, "pack");
    expect(clean.result).toBe(0);

    writeText(project.cwd, "nested/marketplace.json", "{}\n");
    const drifted = await runInProject(project.cwd, [
      "pack",
      "--check-clean",
      "--marketplace-path",
      "copilot=nested/marketplace.json",
    ]);
    expect(drifted.result).toBe(4);
    expect(readFileSync(`${project.cwd}/nested/marketplace.json`, "utf8")).toBe("{}\n");
  });
});
