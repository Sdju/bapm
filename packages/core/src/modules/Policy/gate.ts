import { discoverPolicyPath } from "./discover.ts";
import { PolicyError } from "./errors.ts";
import { isPolicyDisabled } from "./escape.ts";
import { evaluateInstallPolicy } from "./evaluate.ts";
import { loadPolicy } from "./load.ts";
import type { PolicyGateOptions, PolicyGateResult } from "./types.ts";

/**
 * Discover + load + evaluate install policy gate.
 * Dual-conflict / missing explicit file fail closed.
 * Absent local policy → ungated (skipped).
 * Escape via noPolicy / BAPM_POLICY_DISABLE / APM_POLICY_DISABLE.
 */
export function runPolicyGate(options: PolicyGateOptions = {}): PolicyGateResult {
  if (isPolicyDisabled({ noPolicy: options.noPolicy })) {
    return {
      skipped: true,
      absent: false,
      blocking: false,
      diagnostics: [{ code: "POLICY_ESCAPED", message: "Policy gate skipped (escape hatch)" }],
    };
  }

  const explicit = options.policyPath ?? options.policy;

  if (explicit !== undefined) {
    const loaded = loadPolicy({ path: explicit, cwd: options.cwd });
    return evaluateLoaded(loaded, options);
  }

  // Dual-conflict throws here before resolve/download
  const discovered = discoverPolicyPath({ cwd: options.cwd });
  if ("absent" in discovered && discovered.absent) {
    return {
      skipped: true,
      absent: true,
      blocking: false,
      diagnostics: [],
    };
  }

  const loaded = loadPolicy({ path: discovered.path, cwd: options.cwd });
  return evaluateLoaded(loaded, options);
}

/**
 * Assert gate is not blocking; throw PolicyError on block violations.
 */
export function assertPolicyGateAllows(options: PolicyGateOptions = {}): PolicyGateResult {
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
  loaded: ReturnType<typeof loadPolicy>,
  options: PolicyGateOptions,
): PolicyGateResult {
  const result = evaluateInstallPolicy({
    policy: loaded.document,
    candidates: options.candidates,
    dependencies: options.dependencies,
    graphDepth: options.graphDepth,
    maxDepthObserved: options.maxDepthObserved,
  });

  const diagnostics: unknown[] = [
    ...loaded.warnings,
    ...result.warnings,
    ...(result.blocking ? result.violations : []),
    ...(result.outcome === "warn" ? (result.findings ?? []) : []),
  ];

  return {
    skipped: false,
    absent: false,
    blocking: result.blocking,
    result,
    document: loaded.document,
    sourcePath: loaded.sourcePath,
    diagnostics,
  };
}
