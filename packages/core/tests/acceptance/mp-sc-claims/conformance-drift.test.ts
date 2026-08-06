/**
 * mp-sc-claims: generator-only path — conformance:gen / conformance:check exist
 * and drift gate stays green after honesty edits (apply regenerates statement).
 *
 * Note: check-conformance-drift.mjs regenerates then diffs; always restore
 * CONFORMANCE.* afterward so acceptance does not leave a dirty tree.
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
} from "./helpers.ts";

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

describe("mp-sc-claims — conformance gen/check posture", () => {
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
    // After apply + gen, generated statement must not retain P3 marketplace catch-all.
    // On current tree this fails → RED; after honesty regen → GREEN with check still 0.
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
