import { asText } from "../asText.ts";
/**
 * Conformance drift gate stays green after honesty edits.
 *
 * Note: check-conformance-drift.mjs regenerates then diffs; always restore
 * CONFORMANCE.* afterward so the suite does not leave a dirty tree.
 */
import { expect, test, describe } from "vite-plus/test";
import { spawnSync } from "node:child_process";
import { repoRoot } from "./sc-claims-helpers.ts";

function restoreConformanceArtifacts(): void {
  spawnSync("git", ["checkout", "--", "CONFORMANCE.md", "CONFORMANCE.json"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

describe("conformance gen/check honesty posture", () => {
  test("conformance:check exits 0 (drift gate green; statement matches checklist)", () => {
    let result: ReturnType<typeof spawnSync>;
    try {
      result = spawnSync("pnpm", ["run", "conformance:check"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: process.env,
      });
    } finally {
      // Drift script writes regenerated files before diffing — restore always.
      restoreConformanceArtifacts();
    }
    expect(
      result!.status,
      `conformance:check failed:\n${asText(result!.stdout)}\n${asText(result!.stderr)}`,
    ).toBe(0);
  });
});
