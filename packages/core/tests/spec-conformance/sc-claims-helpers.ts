/**
 * Helpers for sc-* honesty floor (promoted from mp-sc-claims acceptance).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  checklistCandidates,
  checklistRows as parseChecklistRows,
  conformanceJsonPath,
  conformanceMdPath,
  findExistingPath,
  loadYamlFile,
  readText,
  repoRoot,
  type ChecklistRow,
} from "./helpers.ts";

export { conformanceJsonPath, conformanceMdPath, readText, repoRoot };
export type { ChecklistRow };

export const checklistPath =
  findExistingPath(checklistCandidates) ??
  join(repoRoot, "tests/spec-conformance/checklist.yml");

export const docsConformanceGuidePath = join(
  repoRoot,
  "apps/docs/guide/conformance.md",
);

/** Already-active sc-* — must stay active with citations. */
export const ACTIVE_SC_IDS = [
  "req-sc-001",
  "req-sc-007",
  "req-sc-009",
] as const;

/** Honesty floor: claim list empty — these stay skipped. */
export const SKIPPED_SC_IDS = [
  "req-sc-002",
  "req-sc-003",
  "req-sc-004",
  "req-sc-005",
  "req-sc-006",
  "req-sc-008",
  "req-sc-010",
  "req-sc-011",
  "req-sc-012",
  "req-sc-013",
] as const;

/** Stale P3 marketplace catch-all that MUST be removed from skipped rationales. */
export const STALE_MARKETPLACE_CATCHALL =
  /Out of scope for P3:\s*marketplace\s*\/\s*plugin|marketplace\s*\/\s*plugin\s*\/\s*soft extras deferred|marketplace\s*\/\s*plugin.*deferred/i;

/** Absolute marketplace/plugin OOS wording that MUST leave Limitations / docs. */
export const ABSOLUTE_MARKETPLACE_OOS =
  /Marketplace\s*\/\s*plugin surfaces are out of scope|^\s*[-*]\s*\*?\*?marketplace\*?\*?\s*\/\s*\*?\*?plugin\*?\*?/im;

export type ChecklistDoc = {
  limitations?: string[];
  scope_out?: string[];
  requirements?: ChecklistRow[];
  [key: string]: unknown;
};

export function loadChecklist(): ChecklistDoc {
  return loadYamlFile(checklistPath) as ChecklistDoc;
}

export function checklistRows(doc: ChecklistDoc = loadChecklist()): ChecklistRow[] {
  return parseChecklistRows(doc);
}

export function byId(rows: ChecklistRow[], id: string): ChecklistRow {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`checklist missing ${id}`);
  return row;
}

/** Split semicolon-separated citation paths; ignore bare CONFORMANCE.* labels. */
export function citationPaths(citation: string | undefined): string[] {
  if (!citation) return [];
  return citation
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !/^CONFORMANCE\.(md|json)$/i.test(p));
}

export function resolveRepoPath(rel: string): string {
  return join(repoRoot, rel);
}

export function pathExistsInRepo(rel: string): boolean {
  return existsSync(resolveRepoPath(rel));
}

/**
 * Theme matchers for refined skipped rationales (design §3 / criteria Exact lists).
 * Require gap-specific keywords that the stale P3 marketplace catch-all does NOT contain
 * (avoid matching only on bare "soft" / "deferred").
 */
export const SKIPPED_RATIONALE_THEMES: Record<
  (typeof SKIPPED_SC_IDS)[number],
  RegExp
> = {
  "req-sc-002":
    /zip.?slip|symlink|hardlink|path.?escape|(partial.+extract|extract.+partial)/i,
  "req-sc-003":
    /host.?class|mp-hosts-auth|redirect.+Auth|Auth.+drop|credential scop/i,
  "req-sc-004":
    /tar\.?gz|size.?\/?\s*entry|entry caps?|100\s*MB|10\s*k/i,
  "req-sc-005":
    /eTLD|PSL|aliases?|credential host.?class/i,
  "req-sc-006":
    /insecure|http parse|http(s)?:\/\/.*gate|registries\.\*\.insecure/i,
  "req-sc-008":
    /git.?HTTP|non-https|credential refuse/i,
  "req-sc-010":
    /approve|user.?local grant|grant store/i,
  "req-sc-011":
    /deny.?wins|org.?polic|install\/audit|audit parity/i,
  "req-sc-012":
    /required.?package|withheld.?executable|audit fidelity/i,
  "req-sc-013":
    /ambient|suppress|host.?class overlap|operator host.?class/i,
};

export function limitationsBlob(doc: ChecklistDoc): string {
  return (doc.limitations ?? []).join("\n");
}

export function scopeOutBlob(doc: ChecklistDoc): string {
  return (doc.scope_out ?? []).join("\n");
}

export function scopeOutHasAbsoluteMarketplace(doc: ChecklistDoc): boolean {
  return (doc.scope_out ?? []).some((item) =>
    /^marketplace\s*\/\s*plugin$/i.test(String(item).trim()),
  );
}

export function limitationsNameResidualSecurity(blob: string): boolean {
  const hostAuth = /host.?class|AuthResolver|mp-hosts-auth|credential scop/i.test(
    blob,
  );
  const approve = /approve|deny.?UX|grant store/i.test(blob);
  const softArchive = /archive|zip|tar\.?gz|caps?|§\s*10|security.?depth/i.test(
    blob,
  );
  return (hostAuth || softArchive) && (approve || softArchive || hostAuth);
}
