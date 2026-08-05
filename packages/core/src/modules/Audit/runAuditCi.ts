import { basename, relative, resolve } from "node:path";
import { collectTreeSha256Violations, loadLockfileOrNull } from "@/modules/Lockfile";
import { collectDeployedHashViolations } from "@/modules/Install";
import { formatAuditCiJson, formatAuditCiSarif, summarizeChecks } from "./formatAuditCi.ts";
import type { AuditCiCheck, AuditCiResult, RunAuditCiOptions } from "./types.ts";

const NOT_EVALUATED = "not evaluated (lockfile missing)";

function buildResult(args: {
  checks: AuditCiCheck[];
  lockRelativePath?: string;
  format?: RunAuditCiOptions["format"];
}): AuditCiResult {
  const { checks, lockRelativePath, format } = args;
  const summary = summarizeChecks(checks);
  const passed = summary.failed === 0;
  const violations = checks
    .filter((c) => !c.passed)
    .flatMap((c) => (c.details.length > 0 ? c.details : [c.message]));
  const text = passed ? "Audit CI clean" : violations.join("\n");
  const base: AuditCiResult = {
    ok: passed,
    exitCode: passed ? 0 : 1,
    violations: passed ? [] : violations,
    diagnostics: passed ? [] : violations,
    text,
    checks,
    passed,
    summary,
    lockRelativePath,
  };

  if (format === "json") {
    const body = formatAuditCiJson(base);
    return { ...base, text: body, body };
  }
  if (format === "sarif") {
    const body = formatAuditCiSarif(base);
    return { ...base, text: body, body };
  }
  return base;
}

/**
 * CI gate: lock present; deployed files present; hash re-verify (lk-017/sc-001);
 * git tree_sha256 re-verify (lk-015) — fail-closed on missing/mismatch.
 * Always emits three structured checks in fixed order.
 */
export async function runAuditCi(options: RunAuditCiOptions = {}): Promise<AuditCiResult> {
  const cwd = resolve(options.cwd ?? process.cwd());

  const loaded = loadLockfileOrNull({ cwd });
  if (!loaded) {
    const checks: AuditCiCheck[] = [
      {
        name: "lockfile-exists",
        passed: false,
        message: "Audit CI failed: lockfile missing / not found",
        details: [],
      },
      {
        name: "content-integrity",
        passed: false,
        message: NOT_EVALUATED,
        details: [],
      },
      {
        name: "tree-sha256",
        passed: false,
        message: NOT_EVALUATED,
        details: [],
      },
    ];
    return buildResult({ checks, format: options.format });
  }

  const lockRelativePath =
    relative(cwd, loaded.sourcePath) || basename(loaded.sourcePath) || loaded.sourceFilename;

  const hashViolations = collectDeployedHashViolations({
    cwd,
    document: loaded.document,
  });
  const treeViolations = collectTreeSha256Violations({
    cwd,
    document: loaded.document,
  });

  const contentPassed = hashViolations.length === 0;
  const treePassed = treeViolations.length === 0;

  const checks: AuditCiCheck[] = [
    {
      name: "lockfile-exists",
      passed: true,
      message: `Lockfile present: ${lockRelativePath}`,
      details: [],
      locations: [lockRelativePath],
    },
    {
      name: "content-integrity",
      passed: contentPassed,
      message: contentPassed
        ? "Deployed file hashes match lock inventory"
        : "Deployed file hash / presence violations",
      details: hashViolations.map((v) => v.message),
      locations: hashViolations.map((v) => v.path),
    },
    {
      name: "tree-sha256",
      passed: treePassed,
      message: treePassed
        ? "Git package tree_sha256 verified"
        : "tree_sha256 missing or mismatched",
      details: treeViolations.map((v) => v.message),
      locations: treeViolations.map((v) => v.entry),
    },
  ];

  return buildResult({ checks, lockRelativePath, format: options.format });
}

export const auditCi = runAuditCi;
export const runAudit = runAuditCi;
