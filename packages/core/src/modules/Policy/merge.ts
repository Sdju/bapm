/**
 * OpenAPM §6.4 policy merge (pl-006) for gate-evaluated families.
 * Parent → child: enforcement stricter-wins; fetch_failure child-overrides-if-set;
 * allow ∩; deny/require ∪; max_depth min; require_pinned_constraint OR.
 */

import { identityMatchesPattern } from "./match.ts";
import type { PolicyDependencies, PolicyDocument, PolicyEnforcement } from "./types.ts";

const ENFORCEMENT_RANK: Record<PolicyEnforcement, number> = {
  off: 0,
  warn: 1,
  block: 2,
};

export type MergePoliciesResult = {
  document: PolicyDocument;
  policy: PolicyDocument;
  effective: PolicyDocument;
};

/**
 * Merge parent into child (child is nearer the leaf). Returns effective document.
 */
export function mergePolicies(parent: unknown, child: unknown): MergePoliciesResult {
  const p = asDoc(parent, "parent");
  const c = asDoc(child, "child");
  const document = mergeDocuments(p, c);
  return { document, policy: document, effective: document };
}

/** Alias names accepted by acceptance helpers. */
export const mergePolicyDocuments = mergePolicies;
export const mergePolicy = mergePolicies;

export function mergeDocuments(parent: PolicyDocument, child: PolicyDocument): PolicyDocument {
  const enforcement = stricterEnforcement(parent.enforcement, child.enforcement);

  const fetch_failure =
    "fetch_failure" in child && child.fetch_failure !== undefined
      ? (child.fetch_failure as PolicyEnforcement)
      : (parent.fetch_failure ?? "warn");

  const dependencies = mergeDependencies(parent.dependencies, child.dependencies);

  const document: PolicyDocument = {
    ...parent,
    ...child,
    name: child.name ?? parent.name,
    enforcement,
    fetch_failure,
  };

  if (dependencies) {
    document.dependencies = dependencies;
  } else {
    delete document.dependencies;
  }

  // Leaf name wins; drop extends from effective (resolved).
  delete document.extends;

  return document;
}

function mergeDependencies(
  parent?: PolicyDependencies,
  child?: PolicyDependencies,
): PolicyDependencies | undefined {
  if (!parent && !child) return undefined;
  const out: PolicyDependencies = {};

  const allow = mergeAllow(parent?.allow, child?.allow);
  if (allow !== undefined) out.allow = allow;

  const deny = mergeUnion(parent?.deny, child?.deny);
  if (deny !== undefined) out.deny = deny;

  const require = mergeUnion(parent?.require, child?.require);
  if (require !== undefined) out.require = require;

  const depths = [parent?.max_depth, child?.max_depth].filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n),
  );
  if (depths.length) out.max_depth = Math.min(...depths);

  const pinnedParent = parent?.require_pinned_constraint;
  const pinnedChild = child?.require_pinned_constraint;
  if (pinnedParent === true || pinnedChild === true) {
    out.require_pinned_constraint = true;
  } else if (pinnedParent === false || pinnedChild === false) {
    out.require_pinned_constraint = Boolean(pinnedChild ?? pinnedParent);
  }

  return Object.keys(out).length ? out : undefined;
}

/** Null transparent; both arrays → intersection of patterns. */
function mergeAllow(
  parent: string[] | null | undefined,
  child: string[] | null | undefined,
): string[] | null | undefined {
  if (parent === undefined && child === undefined) return undefined;
  if (parent === null && (child === undefined || child === null)) return null;
  if (child === null && (parent === undefined || parent === null)) return null;
  if (parent === null) return child === undefined ? null : child;
  if (child === null) return parent === undefined ? null : parent;
  if (parent === undefined) return child;
  if (child === undefined) return parent;

  // Intersection: keep child patterns covered by some parent pattern.
  const out: string[] = [];
  for (const c of child) {
    if (parent.some((p) => patternsCompatible(p, c))) {
      out.push(c);
    }
  }
  return out;
}

function patternsCompatible(parentPattern: string, childPattern: string): boolean {
  if (parentPattern === childPattern) return true;
  // Child concrete identity covered by parent glob/exact
  if (!childPattern.includes("*") && identityMatchesPattern(childPattern, parentPattern)) {
    return true;
  }
  // Parent concrete covered by child glob (rare)
  if (!parentPattern.includes("*") && identityMatchesPattern(parentPattern, childPattern)) {
    return true;
  }
  // Both globs: keep if one is a prefix specialization of the other
  if (parentPattern.endsWith("/*") && childPattern.startsWith(parentPattern.slice(0, -1))) {
    return true;
  }
  return false;
}

/** Union with parent order preserved, then child additions (dedup). Null transparent. */
function mergeUnion(
  parent: string[] | null | undefined,
  child: string[] | null | undefined,
): string[] | null | undefined {
  if (parent === undefined && child === undefined) return undefined;
  if (parent === null && (child === undefined || child === null)) return null;
  if (child === null && (parent === undefined || parent === null)) return null;
  if (parent === null) return child === undefined ? null : child;
  if (child === null) return parent === undefined ? null : parent;
  if (parent === undefined) return child;
  if (child === undefined) return parent;

  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of [...parent, ...child]) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function stricterEnforcement(a: PolicyEnforcement, b: PolicyEnforcement): PolicyEnforcement {
  return ENFORCEMENT_RANK[a] >= ENFORCEMENT_RANK[b] ? a : b;
}

function asDoc(value: unknown, label: string): PolicyDocument {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`mergePolicies ${label} must be a policy document object`);
  }
  const raw = value as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name : label;
  const enforcement = coerceEnforcement(raw.enforcement);
  const fetch_failure =
    "fetch_failure" in raw ? coerceEnforcement(raw.fetch_failure) : undefined;
  const doc: PolicyDocument = {
    ...raw,
    name,
    enforcement,
    fetch_failure: fetch_failure ?? "warn",
  };
  if (raw.dependencies && typeof raw.dependencies === "object") {
    doc.dependencies = raw.dependencies as PolicyDependencies;
  }
  if (fetch_failure === undefined) {
    // Preserve "unset" for child-override semantics when merging raw objects.
    delete (doc as { fetch_failure?: PolicyEnforcement }).fetch_failure;
  }
  return doc;
}

function coerceEnforcement(value: unknown): PolicyEnforcement {
  if (value === false) return "off";
  if (typeof value === "string") {
    const n = value.trim().toLowerCase();
    if (n === "off" || n === "warn" || n === "block") return n;
  }
  return "warn";
}
