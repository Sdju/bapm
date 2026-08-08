## ADDED Requirements

### Requirement: Policy gate before download and materialize

Install orchestration MUST invoke policy discovery and evaluation against the resolved install plan before downloading packages into the modules directory and before target materialize/deploy for the proposed install. When the gate reports blocking violations, install MUST fail closed without those durable writes. When policy is absent or the caller opts out via no-policy/env disable, install MUST behave as before M8 (ungated). Preferred pipeline shape is resolve-plan → policy-gate → download → primitives/targets (OpenAPM pl-002 strict).

#### Scenario: Blocking policy stops before modules write

- **WHEN** install has a resolved plan that violates a blocking policy
- **THEN** install MUST NOT download/write new modules content for that plan and MUST NOT deploy target harness files for that plan

#### Scenario: Ungated path unchanged without policy

- **WHEN** install runs with no discovered policy and no explicit policy path
- **THEN** resolve/download/materialize MUST proceed under existing M3–M7 rules

### Requirement: Install options accept policy controls

Install public options MUST accept an explicit policy path/ref, a no-policy/disable flag, and MUST honor environment disable when wired by the CLI. Dual-conflict of local policy filenames MUST surface as install failure before durable writes.

#### Scenario: Explicit policy path on install

- **WHEN** install is invoked with an explicit policy path to a valid deny/block document matching a planned dep
- **THEN** that policy MUST be used for the gate even if sibling brand files exist
