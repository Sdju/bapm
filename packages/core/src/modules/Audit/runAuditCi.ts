import { resolve } from "node:path";
import { loadLockfileOrNull } from "@/modules/Lockfile";
import { collectDeployedHashViolations } from "@/modules/Install";
import type { AuditCiResult, RunAuditCiOptions } from "./types.ts";

/**
 * CI gate: lock present; deployed files present; hash re-verify (lk-017/sc-001).
 * Does not fail solely on missing tree_sha256.
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

  // tree_sha256 absence is intentional soft — do not fail

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
