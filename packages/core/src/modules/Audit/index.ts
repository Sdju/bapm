/**
 * Audit — CI integrity gate (lock + deployed presence + hash re-verify).
 */

export type { AuditCiResult, RunAuditCiOptions } from "./types.ts";
export { runAuditCi, auditCi, runAudit } from "./runAuditCi.ts";
