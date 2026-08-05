## Purpose

Provides a thin, read-only diagnostic report of the effective bapm policy posture for humans and CI without mutating the project. This is observability over existing Governance, not a new policy engine.

## ADDED Requirements

### Requirement: Core exposes policy status report
The system MUST provide a core helper (`runPolicyStatus` or equivalent) that returns a structured policy status report using the same discovery/resolve path as the install/lock policy gate (`discoverPolicyWithProviders` + `loadPolicy` / `resolvePolicyChain` or shared equivalent). The report MUST be computable without writing lockfiles, manifests, modules, or target harness files. Status MUST NOT invent a second policy-resolution implementation.

#### Scenario: Found local policy
- **WHEN** a project has exactly one discoverable local policy file (`apm-policy.yml` or `bapm-policy.yml`) and status runs
- **THEN** the report outcome MUST indicate found/usable policy and include source path, provider (`local`), and enforcement

#### Scenario: Absent policy
- **WHEN** no local or remote usable policy is discovered and status runs
- **THEN** the report outcome MUST indicate absent (or equivalent) and MUST NOT throw as a hard process failure for default status

#### Scenario: Escape hatch reported
- **WHEN** status runs with no-policy escape (`--no-policy`, or `BAPM_POLICY_DISABLE=1`, or `APM_POLICY_DISABLE=1`)
- **THEN** the report outcome MUST indicate disabled/escaped rather than pretending policy is merely absent

#### Scenario: Dual local-file conflict
- **WHEN** both `apm-policy.yml` and `bapm-policy.yml` are present at the project root and status runs without an explicit `--policy` path
- **THEN** the report MUST surface a diagnostic conflict outcome/message (mapped to `error` or equivalent) and MUST NOT mutate the project

#### Scenario: Discovery or load failure
- **WHEN** remote discovery or schema/load fails in a way the gate would surface as a soft diagnostic
- **THEN** the report outcome MUST indicate `error` (or equivalent) with diagnostics, and default status MUST remain a soft report rather than an uncaught crash

### Requirement: Status report includes stable diagnostic fields
The structured report MUST include stable keys for at least: `outcome`, `source`, `provider`, `enforcement`, `extends_chain`, `rule_counts`, `warnings`, and `diagnostics`. Rule counts MUST cover families bapm evaluates today (`dependencies.allow|deny|require|max_depth|require_pinned_constraint`). Credential-bearing URLs or remote refs in source/extends MUST be redacted. Human-readable output MUST present the same posture fields in compact form (outcome, source, provider/mode, enforcement, extends presence/chain, rule counts). Output SHOULD be ASCII-safe and deterministic for tests. Status MUST NOT invent APM-only cache fields (e.g. cache age) that bapm cannot derive truthfully.

#### Scenario: JSON contains stable keys
- **WHEN** status produces machine-readable output for a found policy
- **THEN** the object MUST include the stable keys and redacted source fields

#### Scenario: Extends presence reflected
- **WHEN** the effective policy used extends resolution
- **THEN** `extends_chain` MUST reflect resolved ancestor refs (redacted) or an empty list when none

#### Scenario: Credential redaction
- **WHEN** a source or extends ref contains credentials or sensitive query material
- **THEN** human and JSON output MUST redact those credentials before display

### Requirement: Status is read-only
Running policy status MUST NOT rewrite lockfiles, manifests, module trees, or target harness files. Network access MUST be limited to existing remote policy discovery already used by the gate path when remote discovery is needed. Status MUST NOT write optional report files unless explicitly planned later (out of P6d).

#### Scenario: No project mutation
- **WHEN** status runs in a project with lock and modules present
- **THEN** lock and modules fingerprints MUST remain unchanged
