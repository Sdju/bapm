/**
 * Policy — OpenAPM-shaped governance: dual-read discovery, parse, evaluate, install gate.
 *
 * ## Public API
 *
 * - Constants: `APM_POLICY_FILE`, `BAPM_POLICY_FILE`, `DEFAULT_POLICY_PROVIDERS`
 * - Discover: `discoverPolicyPath` / `discoverLocalPolicyPath`
 * - Parse/load: `parsePolicy`, `parsePolicyDocument`, `loadPolicy`
 * - Evaluate: `evaluateInstallPolicy` / `evaluatePolicy` / `evaluatePolicyRules`
 * - Gate: `runPolicyGate`, `assertPolicyGateAllows`, `isPolicyDisabled`
 * - Errors: `PolicyError`
 *
 * ## Discovery providers (M8)
 *
 * Default ordered providers = `["local"]` (dual-read `apm-policy.yml` | `bapm-policy.yml`).
 * Remote `github-owner-dotgithub` is deferred N/A (not registered).
 *
 * ## Escape
 *
 * `--no-policy` / `noPolicy: true`, `BAPM_POLICY_DISABLE=1`, `APM_POLICY_DISABLE=1`.
 *
 * ## Optional CLI status
 *
 * Thin `bapm policy status` deferred — diagnostics surface via install/lock gate results.
 *
 * ## Example
 *
 * ```ts
 * import { runPolicyGate, evaluateInstallPolicy } from "@/modules/Policy";
 * const gate = runPolicyGate({ cwd, candidates: [{ id: "leaf" }] });
 * ```
 */
export type {
  DiscoverPolicyOptions,
  DiscoveredPolicy,
  EvaluatePolicyOptions,
  EvaluatePolicyResult,
  LoadPolicyOptions,
  LoadPolicyResult,
  ParsePolicyResult,
  PolicyCandidate,
  PolicyDependencies,
  PolicyDependencyInput,
  PolicyDocument,
  PolicyEnforcement,
  PolicyGateOptions,
  PolicyGateResult,
  PolicyViolation,
} from "./types.ts";

export type { PolicyErrorCode, PolicyWarning } from "./errors.ts";
export { PolicyError } from "./errors.ts";

export {
  APM_POLICY_FILE,
  BAPM_POLICY_FILE,
  DEFAULT_POLICY_PROVIDERS,
  POLICY_DISCOVERY_PROVIDERS,
  defaultPolicyProviders,
} from "./constants.ts";

export { discoverPolicyPath, discoverLocalPolicyPath } from "./discover.ts";
export { loadPolicy } from "./load.ts";
export { parsePolicy, parsePolicyDocument } from "./parse.ts";
export { loadYamlDocument } from "./yaml-load.ts";
export { evaluateInstallPolicy, evaluatePolicy, evaluatePolicyRules } from "./evaluate.ts";
export { isPolicyDisabled } from "./escape.ts";
export { runPolicyGate, assertPolicyGateAllows } from "./gate.ts";
export { identityMatchesPattern, isPinnedConstraint } from "./match.ts";
