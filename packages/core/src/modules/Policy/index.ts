/**
 * Policy — OpenAPM-shaped governance: dual-read + remote discovery, extends
 * resolve/merge, evaluate, install gate.
 *
 * ## Public API
 *
 * - Constants: `APM_POLICY_FILE`, `BAPM_POLICY_FILE`, `DEFAULT_POLICY_PROVIDERS`
 * - Discover: `discoverPolicyPath`, `discoverPolicyWithProviders`, `selectProjectRemote`
 * - Parse/load: `parsePolicy`, `parsePolicyDocument`, `loadPolicy`
 * - Extends: `resolvePolicyChain`, `mergePolicies`, `hostClassOf`
 * - Evaluate: `evaluateInstallPolicy` / `evaluatePolicy` / `evaluatePolicyRules`
 * - Gate: `runPolicyGate`, `assertPolicyGateAllows`, `isPolicyDisabled`
 * - Status: `runPolicyStatus` (read-only posture report)
 * - Errors: `PolicyError`
 *
 * ## Discovery providers (P4)
 *
 * Default ordered providers = `["local", "github-owner-dotgithub", "azure-devops-org-policy"]`.
 * Local dual-read first; remote only when local is absent (and remotes allow).
 * GitHub uses the APM 0.35 `.github-private` → `.github` → `.apm` → `_apm`
 * cascade; Azure DevOps remotes use `apm/apm-policy` then legacy `_apm/_apm`.
 *
 * ## Escape
 *
 * `--no-policy` / `noRepoPolicy: true` skips repository-local policy only;
 * remote/org providers still run so org `deny` / `deny_all` applies.
 * Full escape: `--no-policy-all` / `noPolicy: true`, `BAPM_POLICY_DISABLE=1`,
 * `APM_POLICY_DISABLE=1`.
 * An explicit `--policy <path>` still wins over `noRepoPolicy`.
 *
 * ## Example
 *
 * ```ts
 * import { runPolicyGate, resolvePolicyChain } from "@/modules/Policy";
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
  PolicyExecutables,
  PolicyGateOptions,
  PolicyGateResult,
  PolicyViolation,
} from "./types.ts";

export type {
  PolicyStatusOptions,
  PolicyStatusOutcome,
  PolicyStatusReport,
  PolicyStatusRuleCounts,
} from "./status.ts";

export type { PolicyErrorCode, PolicyWarning } from "./errors.ts";
export { PolicyError } from "./errors.ts";

export {
  APM_POLICY_FILE,
  BAPM_POLICY_FILE,
  DEFAULT_POLICY_PROVIDERS,
  POLICY_DISCOVERY_PROVIDERS,
  defaultPolicyProviders,
  POLICY_PROVIDER_LOCAL,
  POLICY_PROVIDER_GITHUB_OWNER_DOTGITHUB,
  POLICY_PROVIDER_AZURE_DEVOPS_ORG_POLICY,
  POLICY_PROVIDER_AZURE_DEVOPS_ORG,
  POLICY_PROVIDER_ADO_ORG_POLICY,
  POLICY_REPO_CANDIDATES_GITHUB,
} from "./constants.ts";

export { discoverPolicyPath, discoverLocalPolicyPath } from "./discover.ts";
export {
  discoverPolicyWithProviders,
  runPolicyDiscovery,
  discoverPolicyProviders,
  filterNonLocalPolicyProviders,
  isAzureDevOpsProvider,
} from "./providers.ts";
export {
  isAzureDevOpsHost,
  parseAdoRepoFromRemoteUrl,
  buildAdoPolicyApiUrl,
  ADO_POLICY_COORDINATES,
  ADO_API_HOST,
  ADO_SSH_HOST,
} from "./ado.ts";
export {
  selectProjectRemote,
  selectGitRemoteForPolicy,
  resolveProjectRemote,
  listGitRemotes,
} from "./remotes.ts";
export { loadPolicy } from "./load.ts";
export { parsePolicy, parsePolicyDocument } from "./parse.ts";
export { loadYamlDocument } from "./yaml-load.ts";
export {
  resolvePolicyChain,
  resolveExtends,
  resolvePolicyExtends,
  mergePolicyChain,
  POLICY_EXTENDS_MAX_DEPTH,
} from "./resolve.ts";
export { mergePolicies, mergePolicyDocuments, mergePolicy } from "./merge.ts";
export {
  hostClassOf,
  policyHostClass,
  hostClassForPolicy,
  resolveHostClass,
  IMPLEMENTATION_DEFAULT_HOST,
} from "./hostClass.ts";
export { evaluateInstallPolicy, evaluatePolicy, evaluatePolicyRules } from "./evaluate.ts";
export { isPolicyDisabled } from "./escape.ts";
export { runPolicyGate, assertPolicyGateAllows } from "./gate.ts";
export { runPolicyStatus } from "./status.ts";
export { redactPolicyRef } from "./redact.ts";
export { identityMatchesPattern, identitySatisfiesRequire, isPinnedConstraint } from "./match.ts";
export type { IdentityMatchOptions } from "./match.ts";
export {
  asciiLower,
  foldRepoCoordinatePath,
  isCaseInsensitiveGitHost,
  isCaseInsensitivePackageIdentity,
  normalizePackageRepoPath,
} from "@/common/repoIdentityCase.ts";
