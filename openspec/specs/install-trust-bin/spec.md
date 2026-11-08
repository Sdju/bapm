# install-trust-bin Specification

## Purpose

Defines per-invocation consent for marketplace/plugin `bin/` executables on install: `--trust-bin` / `--no-trust-bin`, default skip without explicit consent or persisted allow in every mode (TTY is not implicit consent), and layering over existing ExecutableTrust without a second policy store.

## Requirements

### Requirement: Per-invocation trust-bin flags control bin deploy consent

Install MUST accept mutually exclusive invocation flags that mean: `--trust-bin` consents to deploying dependency/plugin `bin/` executables for this run when the ExecutableTrust deny-wins ladder would otherwise allow; `--no-trust-bin` skips bin deploy for this run even when that ladder would allow. Combining both flags MUST fail closed with a clear error and MUST NOT mutate the project. Neither flag MUST override an org or project deny (or equivalent deny outcome from the shared resolver for executable type `bin`).

#### Scenario: --trust-bin allows when ladder allows

- **WHEN** install runs with `--trust-bin`, a dependency ships deployable `bin/` content, and layered ExecutableTrust for type `bin` returns allow (or skip with no deny)
- **THEN** those bin files MUST be eligible to deploy for that invocation

#### Scenario: --no-trust-bin skips even when policy allows

- **WHEN** install runs with `--no-trust-bin` and project or user grants would allow `bin` for the package
- **THEN** install MUST NOT deploy that package's `bin/` content for the invocation

#### Scenario: Flags cannot override deny

- **WHEN** org or project deny (or deny_all) blocks the package for `bin` and the user passes `--trust-bin`
- **THEN** install MUST still withhold bin deploy for that package

#### Scenario: Mutual exclusion fails closed

- **WHEN** install is invoked with both `--trust-bin` and `--no-trust-bin`
- **THEN** the run MUST exit non-zero with a clear conflict error and MUST NOT write modules, lock, or harness state attributable to that invocation

### Requirement: Non-interactive install defaults to skip bin without consent or allow

When install is non-interactive—truthy `CI`, truthy `BAPM_NON_INTERACTIVE`, stdin is not a TTY, or effective frozen mode is on—and neither `--trust-bin` nor a persisted project/user allow for executable type `bin` (after deny-wins) permits deployment, install MUST NOT deploy dependency/plugin `bin/` content. Skipping withheld bins MUST leave a clear diagnostic; install MUST still be allowed to materialize non-executable primitives unless a separate failure applies.

#### Scenario: CI install skips bin without consent

- **WHEN** install runs with truthy `CI`, no `--trust-bin`, no project/user `bin` allow for the package, and a dependency ships `bin/`
- **THEN** those bin files MUST NOT be written to deploy destinations and a withhold/skip diagnostic MUST be observable

#### Scenario: Frozen install skips bin without consent

- **WHEN** effective frozen install runs without `--trust-bin` and without a persisted `bin` allow for the package
- **THEN** bin deploy MUST be skipped for that package

#### Scenario: Non-interactive with project bin allow deploys

- **WHEN** non-interactive install runs without `--trust-bin` but the project grant surface allows the package for `bin` and no deny applies
- **THEN** bin deploy for that package MUST remain eligible

#### Scenario: Skills still materialize when bin withheld

- **WHEN** bin content is withheld by non-interactive default or `--no-trust-bin` and the same dependency provides a skill
- **THEN** the skill MUST still be eligible to materialize per existing install rules

### Requirement: Default requires explicit consent in every mode

When neither trust-bin flag is set, install MUST deploy dependency/plugin `bin/` content only when the ExecutableTrust ladder for type `bin` returns `allow` from a persisted project/user grant (for example `executables.allow.<pkg>.bin: true`). An interactive terminal MUST NOT be treated as implicit consent. When the ladder returns skip (no grant surface) or the package is not allowed, install MUST withhold bin deploy and leave a clear diagnostic. `--trust-bin` MUST remain the per-invocation explicit consent for packages the ladder does not deny/withhold; it MUST NOT override deny/withhold. When install is interactive and bin deploy is withheld for missing consent, the diagnostic MUST advise passing `--trust-bin` or persisting a `bin` grant with `bapm approve <pkg> --bin`.

#### Scenario: Interactive default withholds without consent

- **WHEN** an interactive install finds deployable `bin/` for a package with no `--trust-bin` and no project/user `bin` allow
- **THEN** bin deploy MUST NOT proceed and a withhold diagnostic MUST mention `--trust-bin` or a persisted `bin` approval

#### Scenario: Interactive --trust-bin deploys without warning

- **WHEN** an interactive install runs with `--trust-bin` for a package the `bin` ladder does not deny/withhold
- **THEN** bin deploy MUST proceed and a trust-posture warning for that consent MUST NOT be emitted

#### Scenario: Interactive persisted bin allow deploys

- **WHEN** an interactive install runs without `--trust-bin` but the project or user grant surface allows the package for `bin` and no deny applies
- **THEN** bin deploy for that package MUST remain eligible

### Requirement: Shared ExecutableTrust ladder for bin type

Bin consent MUST evaluate package approval through the same layered deny-wins resolver used for MCP, with executable type `bin`. Invocation flags MUST apply only after that ladder: deny/withhold from the ladder wins; `--trust-bin` MUST NOT invent a parallel allow store; `--no-trust-bin` MUST force skip when the ladder would allow. Bin grants MUST be expressed under the same `executables` manifest/user-store key as MCP grants.

#### Scenario: Project bin allow satisfies non-interactive without flag

- **WHEN** the project manifest lists the package under `executables.allow` with `bin: true` (or equivalent typed grant) and non-interactive install runs without `--trust-bin`
- **THEN** the shared resolver MUST return allow for `bin` and bin deploy MUST remain eligible subject to `--no-trust-bin`

#### Scenario: Org deny beats --trust-bin

- **WHEN** org policy denies the package (or deny_all) and install passes `--trust-bin`
- **THEN** the effective decision MUST remain deny/withhold for bin deploy
