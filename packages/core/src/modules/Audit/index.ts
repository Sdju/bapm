/**
 * Audit — CI integrity gate (lock + deployed presence + hash re-verify).
 */

export type {
  AuditCiCheck,
  AuditCiCheckName,
  AuditCiFormat,
  AuditCiResult,
  AuditCiStructuredReport,
  AuditCiSummary,
  RunAuditCiOptions,
} from "./types.ts";
export { runAuditCi, auditCi, runAudit } from "./runAuditCi.ts";
export {
  formatAuditCiJson,
  formatAuditCiSarif,
  summarizeChecks,
  toStructuredReport,
} from "./formatAuditCi.ts";
