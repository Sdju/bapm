import { PolicyError } from "./errors.ts";
import { isPolicyDisabled } from "./escape.ts";
import { evaluateInstallPolicy } from "./evaluate.ts";
import { loadPolicy, type LoadPolicyExtendedOptions } from "./load.ts";
import { discoverPolicyWithProviders } from "./providers.ts";
import { resolvePolicyChain, type FetchAncestor } from "./resolve.ts";
import type { GitRemoteEntry } from "./remotes.ts";
import type { PolicyDocument, PolicyGateOptions, PolicyGateResult } from "./types.ts";

export type PolicyGateExtendedOptions = PolicyGateOptions & {
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

/**
 * Discover (+ remote providers) → resolve/merge extends → evaluate install policy gate.
 * Dual-conflict / missing explicit file / fetch_failure:block fail closed.
 * Absent policy → ungated (skipped). Escape via noPolicy / env.
 */
export function runPolicyGate(options: PolicyGateExtendedOptions = {}): PolicyGateResult {
  if (isPolicyDisabled({ noPolicy: options.noPolicy })) {
    return {
      skipped: true,
      absent: false,
      blocking: false,
      diagnostics: [{ code: "POLICY_ESCAPED", message: "Policy gate skipped (escape hatch)" }],
    };
  }

  const explicit = options.policyPath ?? options.policy;
  const loadOpts: LoadPolicyExtendedOptions = {
    cwd: options.cwd,
    providers: options.providers ?? options.policyProviders,
    policyProviders: options.policyProviders ?? options.providers,
    listGitRemotes: options.listGitRemotes,
    remotes: options.remotes,
    fetchAncestor: options.fetchAncestor,
    fetchPolicyUrl: options.fetchPolicyUrl,
    httpGet: options.httpGet,
    defaultFetchFailure: options.defaultFetchFailure,
    implementationDefaultHost: options.implementationDefaultHost,
    leafHostClass: options.leafHostClass,
  };

  if (explicit !== undefined) {
    const loaded = loadPolicy({ ...loadOpts, path: explicit });
    return evaluateLoaded(loaded.document, loaded.sourcePath, loaded.warnings, options);
  }

  // Probe discovery without throwing on absent
  let discovered;
  try {
    discovered = discoverPolicyWithProviders({
      cwd: options.cwd,
      providers: options.providers ?? options.policyProviders,
      listGitRemotes: options.listGitRemotes,
      remotes: options.remotes,
      fetchPolicyUrl: options.fetchPolicyUrl,
      httpGet: options.httpGet,
      defaultFetchFailure: options.defaultFetchFailure ?? "block",
      implementationDefaultHost: options.implementationDefaultHost,
    });
  } catch (err) {
    // pl-010 / pl-012 fail closed
    throw err;
  }

  if ("absent" in discovered && discovered.absent) {
    return {
      skipped: true,
      absent: true,
      blocking: false,
      diagnostics: [],
    };
  }

  // Remote document already in discovery result
  if (discovered.document) {
    let doc = discovered.document;
    if (typeof doc.extends === "string") {
      const resolved = resolvePolicyChain({
        cwd: options.cwd,
        leaf: doc,
        leafHostClass: options.leafHostClass,
        fetchAncestor: options.fetchAncestor,
        fetchPolicyUrl: options.fetchPolicyUrl,
        httpGet: options.httpGet,
      });
      doc = resolved.document;
    }
    return evaluateLoaded(doc, discovered.path ?? discovered.url ?? "remote-policy", [], options);
  }

  if (!discovered.path || /^https?:\/\//i.test(discovered.path)) {
    return {
      skipped: true,
      absent: true,
      blocking: false,
      diagnostics: [],
    };
  }

  const loaded = loadPolicy({ ...loadOpts, path: discovered.path });
  return evaluateLoaded(loaded.document, loaded.sourcePath, loaded.warnings, options);
}

/**
 * Assert gate is not blocking; throw PolicyError on block violations.
 */
export function assertPolicyGateAllows(options: PolicyGateExtendedOptions = {}): PolicyGateResult {
  const gate = runPolicyGate(options);
  if (gate.blocking && gate.result) {
    const first = gate.result.violations[0] ?? gate.result.findings?.[0];
    const detail = first?.message ?? "Policy violation blocked install";
    throw new PolicyError("POLICY_VIOLATION", detail, {
      path: gate.sourcePath,
      details: {
        violations: gate.result.violations,
        findings: gate.result.findings,
        diagnostics: gate.diagnostics,
      },
    });
  }
  return gate;
}

function evaluateLoaded(
  document: PolicyDocument,
  sourcePath: string,
  warnings: unknown[],
  options: PolicyGateExtendedOptions,
): PolicyGateResult {
  const result = evaluateInstallPolicy({
    policy: document,
    candidates: options.candidates,
    dependencies: options.dependencies,
    graphDepth: options.graphDepth,
    maxDepthObserved: options.maxDepthObserved,
  });

  const diagnostics: unknown[] = [
    ...warnings,
    ...result.warnings,
    ...(result.blocking ? result.violations : []),
    ...(result.outcome === "warn" ? (result.findings ?? []) : []),
  ];

  return {
    skipped: false,
    absent: false,
    blocking: result.blocking,
    result,
    document,
    sourcePath,
    diagnostics,
  };
}
