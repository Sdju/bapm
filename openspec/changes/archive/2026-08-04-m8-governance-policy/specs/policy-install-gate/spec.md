## Purpose

Applies policy evaluation as an install lifecycle gate so blocking violations abort before modules materialization and target deploy, with documented escape hatches and SHOULD coverage for lock/update.

## ADDED Requirements

### Requirement: Install gates before durable modules and deploy writes

Full `install` (materialize modules + target deploy) MUST run policy discovery+evaluation after a resolved install **plan** is available and MUST abort on `enforcement: block` with ≥1 violation **before** writing new modules content or target deploy artifacts for the proposed install (pl-002). Preferred ordering is plan → gate → download/materialize.

#### Scenario: Block deny aborts before modules deploy

- **WHEN** a local policy denies a dependency present in the install plan with `enforcement: block` and install runs without escape
- **THEN** install MUST exit non-zero and MUST NOT create new modules/deploy artifacts for that proposed install

#### Scenario: Warn deny allows install with diagnostics

- **WHEN** the same deny exists with `enforcement: warn`
- **THEN** install MUST be allowed to complete (exit 0 on otherwise successful install) and MUST emit policy warning diagnostics

### Requirement: Escape hatch skips policy gate

The system MUST support skipping discovery and checks via an explicit no-policy flag (CLI `--no-policy`) and/or environment disable analogous to APM (`BAPM_POLICY_DISABLE=1`, optionally also recognizing `APM_POLICY_DISABLE=1`). Escape MUST not be modeled as a discovery provider.

#### Scenario: No-policy flag bypasses deny

- **WHEN** a blocking deny policy is present and install runs with `--no-policy` (or env disable set)
- **THEN** the policy gate MUST be skipped and install MAY succeed despite the deny file

### Requirement: Absent policy leaves install ungated

When no policy is discovered and escape is not required, install MUST proceed without policy violations.

#### Scenario: No policy file

- **WHEN** neither local policy file exists and no explicit `--policy` is given
- **THEN** install MUST proceed ungated by policy

### Requirement: Dual-conflict fails before resolve deploy

When both local policy filenames are present without an explicit path, install MUST error before resolve/deploy mutation.

#### Scenario: Dual policy filenames on install

- **WHEN** both `apm-policy.yml` and `bapm-policy.yml` exist at project root and install runs without `--policy`
- **THEN** install MUST fail with dual-conflict diagnostics before modules/deploy writes

### Requirement: Lock command SHOULD apply the same gate

`lock` SHOULD run the same policy gate before lock write and modules download side effects when inexpensive to wire (APM parity). If deferred, the implementation MUST document the skip in design/conformance notes for this change.

#### Scenario: Lock blocked by deny when gated

- **WHEN** lock policy gating is enabled and a blocking deny matches the resolve plan
- **THEN** lock MUST exit non-zero and MUST NOT write a new lockfile (nor download modules) for that proposed plan

### Requirement: Update shares install gate when on install path

When `update` applies changes through the install orchestration path, it MUST apply the same policy gate semantics as install. Dry-run update MUST NOT perform durable writes regardless of policy.

#### Scenario: Update block deny

- **WHEN** update would apply a plan that violates a blocking policy and confirm/`-y` is used without escape
- **THEN** update MUST fail closed without lock/modules/deploy mutation for that plan
