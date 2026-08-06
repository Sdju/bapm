/** Policy document model + discovery / evaluate option bags. */

import type { PolicyWarning } from "./errors.ts";

export type PolicyEnforcement = "off" | "warn" | "block";

export type PolicyDependencies = {
  /** Tri-state: omit/null → unset; [] → explicit empty; [...] → populated. */
  allow?: string[] | null;
  deny?: string[] | null;
  require?: string[] | null;
  max_depth?: number;
  require_pinned_constraint?: boolean;
};

/** Org-policy executables floor (sc-011): deny_all + deny list only for claim. */
export type PolicyExecutables = {
  deny_all?: boolean;
  deny?: string[];
};

export type PolicyDocument = {
  name: string;
  enforcement: PolicyEnforcement;
  fetch_failure: PolicyEnforcement;
  dependencies?: PolicyDependencies;
  executables?: PolicyExecutables;
  /** Extension keys `x-*` and other retained top-level fields. */
  [key: string]: unknown;
};

export type DiscoverPolicyOptions = {
  cwd?: string;
  /** Explicit path wins over dual-read sibling search. */
  path?: string;
};

export type DiscoveredPolicy =
  | { path: string; filename: string; absent?: false; found?: true }
  | { absent: true; found?: false; path?: null };

export type LoadPolicyOptions = {
  cwd?: string;
  path?: string;
};

export type LoadPolicyResult = {
  document: PolicyDocument;
  policy?: PolicyDocument;
  sourcePath: string;
  sourceFilename: string;
  warnings: PolicyWarning[];
};

export type ParsePolicyResult = {
  document: PolicyDocument;
  policy?: PolicyDocument;
  warnings: PolicyWarning[];
};

export type PolicyCandidate = {
  id?: string;
  name?: string;
  ref?: string;
  constraint?: string;
  depth?: number;
  direct?: boolean;
  kind?: string;
  path?: string;
  source?: string;
};

export type PolicyDependencyInput =
  | string
  | {
      name?: string;
      id?: string;
      ref?: string;
      constraint?: string;
      direct?: boolean;
      depth?: number;
      path?: string;
      source?: string;
    };

export type EvaluatePolicyOptions = {
  policy: PolicyDocument;
  candidates?: PolicyCandidate[];
  dependencies?: PolicyDependencyInput[];
  graphDepth?: number;
  maxDepthObserved?: number;
};

export type PolicyViolation = {
  code: string;
  message: string;
  identity?: string;
  rule?: string;
};

export type EvaluatePolicyResult = {
  ok: boolean;
  blocking: boolean;
  blocked?: boolean;
  outcome: "off" | "warn" | "block" | "pass";
  enforcementOutcome?: "off" | "warn" | "block" | "pass";
  mode?: PolicyEnforcement;
  violations: PolicyViolation[];
  warnings: PolicyWarning[];
  findings?: PolicyViolation[];
  errors?: PolicyViolation[];
};

export type PolicyGateOptions = {
  cwd?: string;
  /** Explicit policy file path (`--policy`). */
  policyPath?: string;
  /** Alias accepted by acceptance helpers. */
  policy?: string;
  /** Skip discovery + checks (`--no-policy`). */
  noPolicy?: boolean;
  candidates?: PolicyCandidate[];
  dependencies?: PolicyDependencyInput[];
  graphDepth?: number;
  maxDepthObserved?: number;
};

export type PolicyGateResult = {
  skipped: boolean;
  absent: boolean;
  blocking: boolean;
  result?: EvaluatePolicyResult;
  document?: PolicyDocument;
  sourcePath?: string;
  diagnostics: unknown[];
};
