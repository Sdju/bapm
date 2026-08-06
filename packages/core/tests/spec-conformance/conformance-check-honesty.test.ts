/**
 * Conformance gen/check honesty (promoted from mp-sc-claims): scripts exist
 * and drift gate stays green after honesty edits.
 *
 * Note: check-conformance-drift.mjs regenerates then diffs; always restore
 * CONFORMANCE.* afterward so the suite does not leave a dirty tree.
 */
import { expect, test, describe } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  STALE_MARKETPLACE_CATCHALL,
  conformanceJsonPath,
  conformanceMdPath,
  repoRoot,
} from "./sc-claims-helpers.ts";

function rootScripts(): Record<string, string> {
  const pkg = JSON.parse(
    readFileSync(join(repoRoot, "package.json"), "utf8"),
  ) as { scripts?: Record<string, string> };
  return pkg.scripts ?? {};
}

function restoreConformanceArtifacts(): void {
  spawnSync(
    "git",
    ["checkout", "--", "CONFORMANCE.md", "CONFORMANCE.json"],
    { cwd: repoRoot, encoding: "utf8" },
  );
}

describe("conformance gen/check honesty posture", () => {
  test("root package.json wires conformance:gen and conformance:check", () => {
    const scripts = rootScripts();
    expect(scripts["conformance:gen"], "conformance:gen script").toBeTruthy();
    expect(scripts["conformance:check"], "conformance:check script").toBeTruthy();

    const genScript = join(repoRoot, "scripts/gen-conformance-statement.mjs");
    const checkScript = join(repoRoot, "scripts/check-conformance-drift.mjs");
    expect(existsSync(genScript), genScript).toBe(true);
    expect(existsSync(checkScript), checkScript).toBe(true);
  });

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
      `conformance:check failed:\n${result!.stdout ?? ""}\n${result!.stderr ?? ""}`,
    ).toBe(0);
  });

  test("committed CONFORMANCE artifacts reflect honesty floor (no stale sc catch-all)", () => {
    const md = readFileSync(conformanceMdPath, "utf8");
    const json = readFileSync(conformanceJsonPath, "utf8");

    expect(
      STALE_MARKETPLACE_CATCHALL.test(md),
      "CONFORMANCE.md still has stale marketplace catch-all — regenerate after checklist honesty",
    ).toBe(false);
    expect(
      STALE_MARKETPLACE_CATCHALL.test(json),
      "CONFORMANCE.json still has stale marketplace catch-all — regenerate after checklist honesty",
    ).toBe(false);
  });
});
