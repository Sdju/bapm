/**
 * Helpers for policy-canonical-identity-casing acceptance (RED → GREEN).
 * Specs: policy-rule-evaluate (req-pl-018), dependency-resolve (req-rs-016 §3).
 */
import * as core from "@b-apm/core";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

type AnyFn = (...args: never[]) => unknown;

export type TempProject = { cwd: string; cleanup: () => void };

export function createTempProject(prefix = "bapm-pl018-"): TempProject {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

export function writeText(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

export function writePolicy(cwd: string, filename: string, contents: string): string {
  const path = join(cwd, filename);
  writeText(path, contents);
  return path;
}

function pickExport(names: string[], label: string): AnyFn {
  const c = core as Record<string, unknown>;
  for (const name of names) {
    const fn = c[name];
    if (typeof fn === "function") return fn as AnyFn;
  }
  throw new TypeError(`expected @b-apm/core to export one of [${names.join(", ")}] (${label})`);
}

export function getParsePolicy(): (input: unknown) => unknown {
  return pickExport(["parsePolicy", "parsePolicyDocument"], "policy parse") as (
    input: unknown,
  ) => unknown;
}

export function getEvaluatePolicy(): (options: Record<string, unknown>) => unknown {
  return pickExport(
    ["evaluateInstallPolicy", "evaluatePolicy", "evaluatePolicyRules"],
    "policy evaluate",
  ) as (options: Record<string, unknown>) => unknown;
}

export function getMergePolicies(): (parent: unknown, child: unknown) => unknown {
  return pickExport(["mergePolicies", "mergePolicyDocuments", "mergePolicy"], "policy merge") as (
    parent: unknown,
    child: unknown,
  ) => unknown;
}

export function getRunPolicyGate(): (options: Record<string, unknown>) => unknown {
  return pickExport(["runPolicyGate", "assertPolicyGateAllows"], "policy gate") as (
    options: Record<string, unknown>,
  ) => unknown;
}

export function getNormalizeRepoIdentity(): (repoUrl: string) => string {
  return pickExport(["normalizeRepoIdentity", "toLockRepoUrl"], "repo identity normalize") as (
    repoUrl: string,
  ) => string;
}

/** Soft-resolve Lockfile identity helper when exported; otherwise undefined. */
export function tryNormalizePackageRepoUrl():
  | ((repoUrl: string, options?: Record<string, unknown>) => string)
  | undefined {
  const c = core as Record<string, unknown>;
  for (const name of ["normalizePackageRepoUrl", "normalizeLockPackageRepoUrl"]) {
    const fn = c[name];
    if (typeof fn === "function") {
      return fn as (repoUrl: string, options?: Record<string, unknown>) => string;
    }
  }
  return undefined;
}

export function policyOf(result: unknown): Record<string, unknown> {
  if (result === null || typeof result !== "object") {
    throw new TypeError("expected policy parse/merge result object");
  }
  const r = result as Record<string, unknown>;
  const doc = (r.document ?? r.policy ?? r.effective ?? r.effectivePolicy ?? r) as Record<
    string,
    unknown
  >;
  if (doc === null || typeof doc !== "object") {
    throw new TypeError("expected document/policy/effective object on result");
  }
  return doc;
}

export function parsePolicyDoc(doc: Record<string, unknown>): Record<string, unknown> {
  return policyOf(getParsePolicy()(doc));
}

export function violationsOf(result: unknown): unknown[] {
  if (!result || typeof result !== "object") return [];
  const r = result as Record<string, unknown>;
  for (const key of ["violations", "errors", "findings"] as const) {
    if (Array.isArray(r[key])) return r[key] as unknown[];
  }
  return [];
}

export function isBlocking(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const r = result as Record<string, unknown>;
  if (r.blocking === true || r.blocked === true) return true;
  if (r.outcome === "block" || r.enforcementOutcome === "block") return true;
  if (r.ok === false && (r.blocking === true || r.mode === "block")) return true;
  return false;
}

export function hasRuleViolation(result: unknown, rule: RegExp | string): boolean {
  const needle = typeof rule === "string" ? new RegExp(rule, "i") : rule;
  for (const v of violationsOf(result)) {
    const text = typeof v === "string" ? v : JSON.stringify(v);
    if (needle.test(text)) return true;
  }
  return needle.test(JSON.stringify(result));
}

export function allowListOf(doc: Record<string, unknown>): string[] {
  const deps = doc.dependencies;
  if (!deps || typeof deps !== "object" || Array.isArray(deps)) return [];
  const allow = (deps as Record<string, unknown>).allow;
  return Array.isArray(allow) ? allow.map(String) : [];
}

export function denyListOf(doc: Record<string, unknown>): string[] {
  const deps = doc.dependencies;
  if (!deps || typeof deps !== "object" || Array.isArray(deps)) return [];
  const deny = (deps as Record<string, unknown>).deny;
  return Array.isArray(deny) ? deny.map(String) : [];
}

export { join };
