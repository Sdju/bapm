/**
 * G6 5.3 — marketplace-only: emit JSON without requiring empty/minimal zip.
 */
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createTempProject,
  expectKnownCommand,
  findZipUnder,
  hasClaudeMarketplaceJson,
  runInProject,
  type TempProject,
  writeClaudeLocalAuthoring,
} from "./helpers.ts";

describe("mp-pack-outputs CLI marketplace-only (no empty zip)", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  test("marketplace-only project emits Claude JSON and does not write empty zip", async () => {
    project = createTempProject();
    // Authoring-only intent: marketplace: + local plugin stub, no extra pack tree.
    writeClaudeLocalAuthoring(project.cwd, { withManifestDeps: false });

    const { result, combined } = await runInProject(project.cwd, [
      "pack",
      "--marketplace",
      "claude",
    ]);
    expectKnownCommand(combined, "pack");
    expect(result).toBe(0);
    expect(hasClaudeMarketplaceJson(project.cwd)).toBe(true);
    // D2: skip empty/minimal placeholder zip for marketplace-only emit.
    expect(findZipUnder(project.cwd)).toBeUndefined();
  });
});
