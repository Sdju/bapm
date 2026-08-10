import type {
  AuditCiCheck,
  AuditCiResult,
  AuditCiStructuredReport,
  AuditCiSummary,
} from "./types.ts";
import { getVersion } from "@/common/packageVersion.ts";

const SARIF_SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json";
const SARIF_VERSION = "2.1.0";
const DRIVER_NAME = "bapm-audit";

function publicCheck(check: AuditCiCheck): AuditCiCheck {
  return {
    name: check.name,
    passed: check.passed,
    message: check.message,
    details: check.details,
  };
}

export function summarizeChecks(checks: AuditCiCheck[]): AuditCiSummary {
  const passed = checks.filter((c) => c.passed).length;
  return {
    total: checks.length,
    passed,
    failed: checks.length - passed,
  };
}

export function toStructuredReport(result: AuditCiResult): AuditCiStructuredReport {
  return {
    passed: result.passed,
    checks: result.checks.map(publicCheck),
    summary: result.summary,
  };
}

/**
 * Pure JSON serializer (indent 2, stable top-level key order: passed → checks → summary).
 */
export function formatAuditCiJson(result: AuditCiResult): string {
  const report = toStructuredReport(result);
  // Build object with insertion order passed → checks → summary
  const doc: AuditCiStructuredReport = {
    passed: report.passed,
    checks: report.checks,
    summary: report.summary,
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

type SarifResult = {
  ruleId: string;
  level: "error";
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
    };
  }>;
};

function lockUri(result: AuditCiResult): string {
  return result.lockRelativePath ?? "bapm.lock.yaml";
}

function uriForDetail(check: AuditCiCheck, detailIndex: number, fallback: string): string {
  const locs = check.locations;
  if (locs && locs[detailIndex]) return locs[detailIndex]!;
  if (locs && locs.length === 1) return locs[0]!;
  return fallback;
}

/**
 * Pure SARIF 2.1.0 serializer. No snippets / no file body regions.
 */
export function formatAuditCiSarif(result: AuditCiResult): string {
  const fallback = lockUri(result);
  const results: SarifResult[] = [];

  for (const check of result.checks) {
    if (check.passed) continue;

    if (check.details.length === 0) {
      results.push({
        ruleId: check.name,
        level: "error",
        message: { text: check.message },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: fallback },
            },
          },
        ],
      });
      continue;
    }

    for (let i = 0; i < check.details.length; i += 1) {
      const detail = check.details[i]!;
      results.push({
        ruleId: check.name,
        level: "error",
        message: { text: detail },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: uriForDetail(check, i, fallback) },
            },
          },
        ],
      });
    }
  }

  const rules = [
    {
      id: "lockfile-exists",
      shortDescription: { text: "Lockfile must be present" },
    },
    {
      id: "content-integrity",
      shortDescription: { text: "Deployed file hashes must match lock inventory" },
    },
    {
      id: "tree-sha256",
      shortDescription: { text: "Git package tree_sha256 must verify" },
    },
  ];

  const doc = {
    $schema: SARIF_SCHEMA,
    version: SARIF_VERSION,
    runs: [
      {
        tool: {
          driver: {
            name: DRIVER_NAME,
            version: getVersion(),
            rules,
          },
        },
        results,
      },
    ],
  };

  return `${JSON.stringify(doc, null, 2)}\n`;
}
