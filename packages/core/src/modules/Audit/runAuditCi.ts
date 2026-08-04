import { resolve } from "node:path";
import { collectTreeSha256Violations, loadLockfileOrNull } from "@/modules/Lockfile";
import { collectDeployedHashViolations } from "@/modules/Install";
import type { AuditCiResult, RunAuditCiOptions } from "./types.ts";

/**
 * CI gate: lock present; deployed files present; hash re-verify (lk-017/sc-001);
 * git tree_sha256 re-verify (lk-015) — fail-closed on missing/mismatch.
 */
export async function runAuditCi(options: RunAuditCiOptions = {}): Promise<AuditCiResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const violations: string[] = [];

  const loaded = loadLockfileOrNull({ cwd });
  if (!loaded) {
    const msg = "Audit CI failed: lockfile missing / not found";
    return {
      ok: false,
      exitCode: 1,
      violations: [msg],
      diagnostics: [msg],
      text: msg,
    };
  }

  const hashViolations = collectDeployedHashViolations({
    cwd,
    document: loaded.document,
  });
  for (const v of hashViolations) {
    violations.push(v.message);
  }

  const treeViolations = collectTreeSha256Violations({
    cwd,
    document: loaded.document,
  });
  for (const v of treeViolations) {
    violations.push(v.message);
  }

  if (violations.length > 0) {
    return {
      ok: false,
      exitCode: 1,
      violations,
      diagnostics: violations,
      text: violations.join("\n"),
    };
  }

  return {
    ok: true,
    exitCode: 0,
    violations: [],
    diagnostics: [],
    text: "Audit CI clean",
  };
}

export const auditCi = runAuditCi;
export const runAudit = runAuditCi;
