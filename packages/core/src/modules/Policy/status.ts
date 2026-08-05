/**
 * Read-only policy posture report (P6d). Reuses discover / load / resolve — no second resolver.
 */

import { existsSync, readFileSync } from "node:fs";
import { PolicyError } from "./errors.ts";
import { isPolicyDisabled } from "./escape.ts";
import type { LoadPolicyExtendedOptions } from "./load.ts";
import { parsePolicyDocument } from "./parse.ts";
import { discoverPolicyWithProviders } from "./providers.ts";
import { redactPolicyRef, redactValue } from "./redact.ts";
import { resolvePolicyChain, type FetchAncestor } from "./resolve.ts";
import type { GitRemoteEntry } from "./remotes.ts";
import type { PolicyDependencies, PolicyDocument, PolicyEnforcement } from "./types.ts";
import { loadYamlDocument } from "./yaml-load.ts";

export type PolicyStatusOutcome = "found" | "absent" | "disabled" | "error";

export type PolicyStatusRuleCounts = {
  allow: number;
  deny: number;
  require: number;
  max_depth: number;
  require_pinned_constraint: number;
  /** Nested form accepted by flexible readers. */
  dependencies?: {
    allow: number;
    deny: number;
    require: number;
    max_depth: number;
    require_pinned_constraint: number;
  };
};

export type PolicyStatusReport = {
  outcome: PolicyStatusOutcome;
  source: string | null;
  provider: string;
  enforcement: PolicyEnforcement | null;
  extends_chain: string[];
  rule_counts: PolicyStatusRuleCounts;
  warnings: unknown[];
  diagnostics: unknown[];
};

export type PolicyStatusOptions = {
  cwd?: string;
  policyPath?: string;
  policy?: string;
  noPolicy?: boolean;
  providers?: string[];
  policyProviders?: string[];
  listGitRemotes?: (cwd?: string) => GitRemoteEntry[];
  remotes?: GitRemoteEntry[];
  fetchAncestor?: FetchAncestor;
  fetchPolicyUrl?: LoadPolicyExtendedOptions["fetchPolicyUrl"];
  httpGet?: LoadPolicyExtendedOptions["httpGet"];
  defaultFetchFailure?: "off" | "warn" | "block";
  implementationDefaultHost?: string;
  leafHostClass?: string;
};

const EMPTY_COUNTS: PolicyStatusRuleCounts = {
  allow: 0,
  deny: 0,
  require: 0,
  max_depth: 0,
  require_pinned_constraint: 0,
  dependencies: {
    allow: 0,
    deny: 0,
    require: 0,
    max_depth: 0,
    require_pinned_constraint: 0,
  },
};

/**
 * Compute a structured policy status report without mutating the project.
 * Soft-maps dual-conflict / fetch / schema failures to `outcome: error` (no throw).
 */
export function runPolicyStatus(options: PolicyStatusOptions = {}): PolicyStatusReport {
  if (isPolicyDisabled({ noPolicy: options.noPolicy })) {
    return finalizeReport({
      outcome: "disabled",
      source: null,
      provider: "escaped",
      enforcement: null,
      extends_chain: [],
      rule_counts: emptyCounts(),
      warnings: [],
      diagnostics: [
        {
          code: "POLICY_ESCAPED",
          message: "Policy status skipped (escape hatch: --no-policy or POLICY_DISABLE env)",
        },
      ],
    });
  }

  const explicit = options.policyPath ?? options.policy;
  try {
    if (explicit !== undefined) {
      return statusFromPath(explicit, { ...options, providerHint: "explicit" });
    }

    const discovered = discoverPolicyWithProviders({
      cwd: options.cwd,
      providers: options.providers ?? options.policyProviders,
      listGitRemotes: options.listGitRemotes,
      remotes: options.remotes,
      fetchPolicyUrl: options.fetchPolicyUrl,
      httpGet: options.httpGet,
      defaultFetchFailure: options.defaultFetchFailure ?? "block",
      implementationDefaultHost: options.implementationDefaultHost,
    });

    if ("absent" in discovered && discovered.absent) {
      return finalizeReport({
        outcome: "absent",
        source: null,
        provider: "none",
        enforcement: null,
        extends_chain: [],
        rule_counts: emptyCounts(),
        warnings: [],
        diagnostics: [],
      });
    }

    const provider = discovered.provider ?? "local";

    if (discovered.document) {
      return statusFromDocument(discovered.document, {
        sourcePath: discovered.path ?? discovered.url ?? "remote-policy",
        provider,
        options,
      });
    }

    if (!discovered.path || /^https?:\/\//i.test(discovered.path)) {
      return finalizeReport({
        outcome: "absent",
        source: null,
        provider: "none",
        enforcement: null,
        extends_chain: [],
        rule_counts: emptyCounts(),
        warnings: [],
        diagnostics: [],
      });
    }

    return statusFromPath(discovered.path, { ...options, providerHint: provider });
  } catch (err) {
    return errorReport(err);
  }
}

function statusFromPath(
  pathArg: string,
  options: PolicyStatusOptions & { providerHint: string },
): PolicyStatusReport {
  if (!existsSync(pathArg)) {
    throw new PolicyError("POLICY_MISSING_FILE", `Policy file not found: ${pathArg}`, {
      path: pathArg,
    });
  }
  const text = readFileSync(pathArg, "utf8");
  const raw = loadYamlDocument(text, pathArg);
  const parsed = parsePolicyDocument(raw);
  return statusFromDocument(parsed.document, {
    sourcePath: pathArg,
    provider: options.providerHint,
    options,
    warnings: parsed.warnings,
  });
}

function statusFromDocument(
  leaf: PolicyDocument,
  args: {
    sourcePath: string;
    provider: string;
    options: PolicyStatusOptions;
    warnings?: unknown[];
  },
): PolicyStatusReport {
  const warnings: unknown[] = [...(args.warnings ?? [])];
  let effective = leaf;
  let extendsChain: string[] = [];

  if (typeof leaf.extends === "string") {
    const resolved = resolvePolicyChain({
      cwd: args.options.cwd,
      path: args.sourcePath,
      leafPath: args.sourcePath,
      leaf,
      leafHostClass: args.options.leafHostClass,
      fetchAncestor: args.options.fetchAncestor,
      fetchPolicyUrl: args.options.fetchPolicyUrl,
      httpGet: args.options.httpGet,
    });
    effective = resolved.document;
    warnings.push(...resolved.warnings);
    // Prefer original extends refs (avoid path.resolve mangling of URLs in chain ids)
    extendsChain = [leaf.extends];
    for (const id of resolved.chain.slice(2)) {
      extendsChain.push(id);
    }
  }

  return finalizeReport({
    outcome: "found",
    source: args.sourcePath,
    provider: args.provider,
    enforcement: effective.enforcement,
    extends_chain: extendsChain,
    rule_counts: computeRuleCounts(effective.dependencies),
    warnings,
    diagnostics: [],
  });
}

function computeRuleCounts(deps?: PolicyDependencies): PolicyStatusRuleCounts {
  const allow = Array.isArray(deps?.allow) ? deps!.allow!.length : 0;
  const deny = Array.isArray(deps?.deny) ? deps!.deny!.length : 0;
  const require = Array.isArray(deps?.require) ? deps!.require!.length : 0;
  const max_depth =
    typeof deps?.max_depth === "number" && Number.isFinite(deps.max_depth) ? deps.max_depth : 0;
  const require_pinned_constraint = deps?.require_pinned_constraint === true ? 1 : 0;
  const nested = { allow, deny, require, max_depth, require_pinned_constraint };
  return { ...nested, dependencies: nested };
}

function emptyCounts(): PolicyStatusRuleCounts {
  return {
    ...EMPTY_COUNTS,
    dependencies: { ...EMPTY_COUNTS.dependencies! },
  };
}

function errorReport(err: unknown): PolicyStatusReport {
  const pe = err instanceof PolicyError ? err : null;
  const message = err instanceof Error ? err.message : String(err);
  const code = pe?.code ?? "POLICY_STATUS_ERROR";
  const details = pe?.details;
  const diagnostics: unknown[] = [
    {
      code,
      message,
      ...(details ? { details } : {}),
      ...(pe?.path ? { path: pe.path } : {}),
    },
  ];

  // Dual-conflict: surface both filenames in diagnostics for acceptance matchers
  if (pe?.code === "POLICY_DUAL_CONFLICT" && details) {
    diagnostics.push({
      code: "POLICY_DUAL_CONFLICT",
      message: `dual conflict: both apm-policy.yml and bapm-policy.yml present`,
      details,
    });
  }

  return finalizeReport({
    outcome: "error",
    source: pe?.path ?? null,
    provider: pe?.code === "POLICY_DUAL_CONFLICT" ? "local" : "none",
    enforcement: null,
    extends_chain: [],
    rule_counts: emptyCounts(),
    warnings: [],
    diagnostics,
  });
}

function finalizeReport(report: PolicyStatusReport): PolicyStatusReport {
  return {
    outcome: report.outcome,
    source: report.source == null ? null : redactPolicyRef(report.source),
    provider: report.provider,
    enforcement: report.enforcement,
    extends_chain: report.extends_chain.map(redactPolicyRef),
    rule_counts: report.rule_counts,
    warnings: redactValue(report.warnings) as unknown[],
    diagnostics: redactValue(report.diagnostics) as unknown[],
  };
}
