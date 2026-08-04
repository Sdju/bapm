import type { PolicyWarning } from "./errors.ts";
import { anyIdentityMatches, identityMatchesPattern, isPinnedConstraint } from "./match.ts";
import type {
  EvaluatePolicyOptions,
  EvaluatePolicyResult,
  PolicyCandidate,
  PolicyDependencyInput,
  PolicyViolation,
} from "./types.ts";

/**
 * Evaluate policy rules against install candidates.
 * Deny wins over allow; enforcement off|warn|block maps to gate outcome.
 */
export function evaluateInstallPolicy(options: EvaluatePolicyOptions): EvaluatePolicyResult {
  const policy = options.policy;
  const enforcement = policy.enforcement ?? "warn";

  if (enforcement === "off") {
    return {
      ok: true,
      blocking: false,
      blocked: false,
      outcome: "off",
      enforcementOutcome: "off",
      mode: "off",
      violations: [],
      warnings: [],
      findings: [],
      errors: [],
    };
  }

  const entries = normalizeEntries(options);
  const identities = entries.map((e) => e.id);
  const violations: PolicyViolation[] = [];
  const warnings: PolicyWarning[] = [];

  const deps = policy.dependencies;

  // Deny (wins over allow)
  if (deps?.deny && Array.isArray(deps.deny)) {
    for (const pattern of deps.deny) {
      for (const entry of entries) {
        if (identityMatchesPattern(entry.id, pattern)) {
          violations.push({
            code: "POLICY_DENY",
            message: `Dependency "${entry.id}" denied by policy pattern "${pattern}"`,
            identity: entry.id,
            rule: "deny",
          });
        }
      }
    }
  }

  // Allow list: when present (including []), identities not matching any allow are violations
  // (unless already denied). Explicit empty allow means nothing is allowed.
  if (deps && "allow" in deps && deps.allow !== undefined && deps.allow !== null) {
    const allow = deps.allow;
    for (const entry of entries) {
      const denied = deps.deny?.some((p) => identityMatchesPattern(entry.id, p)) === true;
      if (denied) continue;
      if (allow.length === 0 || !allow.some((p) => identityMatchesPattern(entry.id, p))) {
        violations.push({
          code: "POLICY_ALLOW",
          message: `Dependency "${entry.id}" is not allowed by policy allow list`,
          identity: entry.id,
          rule: "allow",
        });
      }
    }
  }

  // Require missing
  if (deps?.require && Array.isArray(deps.require)) {
    for (const pattern of deps.require) {
      if (!anyIdentityMatches(identities, pattern)) {
        violations.push({
          code: "POLICY_REQUIRE",
          message: `Required dependency "${pattern}" is missing from install candidates`,
          identity: pattern,
          rule: "require",
        });
      }
    }
  }

  // max_depth
  if (deps?.max_depth !== undefined) {
    const observed =
      options.maxDepthObserved ??
      options.graphDepth ??
      Math.max(0, ...entries.map((e) => e.depth ?? 0));
    if (observed > deps.max_depth) {
      violations.push({
        code: "POLICY_MAX_DEPTH",
        message: `Graph depth ${observed} exceeds policy max_depth ${deps.max_depth}`,
        rule: "max_depth",
      });
    }
  }

  // require_pinned_constraint (direct only)
  if (deps?.require_pinned_constraint === true) {
    for (const entry of entries) {
      const isDirect = entry.direct === true || entry.depth === 1 || entry.depth === undefined;
      if (!isDirect) continue;
      if (
        !isPinnedConstraint({
          ref: entry.ref,
          constraint: entry.constraint,
          path: entry.path,
          source: entry.source,
          kind: entry.kind,
        })
      ) {
        const shown = entry.constraint ?? entry.ref ?? "(unbounded)";
        violations.push({
          code: "POLICY_PINNED_CONSTRAINT",
          message: `Direct dependency "${entry.id}" has unbounded/unpinned constraint "${shown}" (require_pinned_constraint)`,
          identity: entry.id,
          rule: "require_pinned_constraint",
        });
      }
    }
  }

  const blocking = enforcement === "block" && violations.length > 0;
  const outcome = violations.length === 0 ? "pass" : enforcement === "block" ? "block" : "warn";

  if (enforcement === "warn" && violations.length > 0) {
    for (const v of violations) {
      warnings.push({
        code: v.code,
        message: v.message,
        path: v.identity,
      });
    }
  }

  return {
    ok: !blocking,
    blocking,
    blocked: blocking,
    outcome,
    enforcementOutcome: outcome,
    mode: enforcement,
    // Keep violations populated for both block and warn (callers use `blocking`).
    violations,
    warnings,
    findings: violations,
    errors: blocking ? violations : [],
  };
}

/** Aliases accepted by acceptance helpers. */
export const evaluatePolicy = evaluateInstallPolicy;
export const evaluatePolicyRules = evaluateInstallPolicy;

type NormalizedEntry = {
  id: string;
  ref?: string;
  constraint?: string;
  depth?: number;
  direct?: boolean;
  path?: string;
  source?: string;
  kind?: string;
};

function normalizeEntries(options: EvaluatePolicyOptions): NormalizedEntry[] {
  const out: NormalizedEntry[] = [];
  const seen = new Set<string>();

  const push = (entry: NormalizedEntry) => {
    if (!entry.id || seen.has(entry.id)) {
      // Still allow duplicate ids with different refs for pin checks — use composite key
      const key = `${entry.id}|${entry.ref ?? ""}|${entry.constraint ?? ""}|${entry.depth ?? ""}`;
      if (seen.has(key)) return;
      seen.add(key);
    } else {
      seen.add(entry.id);
    }
    out.push(entry);
  };

  for (const c of options.candidates ?? []) {
    push(fromCandidate(c));
  }
  for (const d of options.dependencies ?? []) {
    push(fromDependency(d));
  }

  return out;
}

function fromCandidate(c: PolicyCandidate): NormalizedEntry {
  const id = String(c.id ?? c.name ?? "");
  return {
    id,
    ref: c.ref,
    constraint: c.constraint ?? c.ref,
    depth: c.depth,
    direct: c.direct,
    path: c.path,
    source: c.source,
    kind: c.kind,
  };
}

function fromDependency(d: PolicyDependencyInput): NormalizedEntry {
  if (typeof d === "string") {
    return { id: d, direct: true, depth: 1 };
  }
  const id = String(d.id ?? d.name ?? "");
  return {
    id,
    ref: d.ref,
    constraint: d.constraint ?? d.ref,
    depth: d.depth,
    direct: d.direct,
    path: d.path,
    source: d.source,
  };
}
