# install-trust-bin Specification

## Purpose

Defines per-invocation consent for marketplace/plugin `bin/` executables on install: `--trust-bin` / `--no-trust-bin`, non-interactive default skip, and layering over existing ExecutableTrust without a second policy store.

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

### Requirement: Interactive default warns then deploys when ladder allows

When install is interactive (none of the non-interactive signals above) and neither trust-bin flag is set, and the ExecutableTrust ladder for type `bin` does not deny/withhold the package, install MUST be allowed to deploy `bin/` content and MUST emit a clear trust-posture warning that advises passing `--trust-bin` for explicit consent (or using `approve` / project grants for persistence). `--trust-bin` MUST suppress that warning for allowed packages. Absent grant surface (resolver skip) MUST NOT by itself block interactive bin deploy under this default.

#### Scenario: Interactive neither flag warns and deploys

- **WHEN** an interactive install finds deployable `bin/` for a package that is not denied/withheld by the `bin` trust ladder and neither flag is set
- **THEN** bin deploy MUST proceed and stdout or stderr MUST include a trust-posture warning mentioning `--trust-bin`

#### Scenario: Interactive --trust-bin deploys without warning

- **WHEN** an interactive install runs with `--trust-bin` for an allowed package with `bin/`
- **THEN** bin deploy MUST proceed and the trust-posture warning for that consent MUST NOT be required

### Requirement: Shared ExecutableTrust ladder for bin type

Bin consent MUST evaluate package approval through the same layered deny-wins resolver used for MCP (`resolveExecutableTrust` / classify twin), with `executableType` `bin`. Invocation flags MUST apply only after that ladder: deny/withhold from the ladder wins; `--trust-bin` MUST NOT invent a parallel allow store; `--no-trust-bin` MUST force skip when the ladder would allow. Documentation MUST NOT claim a second bin-only policy noun besides `executables`.

#### Scenario: Project bin allow satisfies non-interactive without flag

- **WHEN** the project manifest lists the package under `executables.allow` with `bin: true` (or equivalent typed grant) and non-interactive install runs without `--trust-bin`
- **THEN** the shared resolver MUST return allow for `bin` and bin deploy MUST remain eligible subject to `--no-trust-bin`

#### Scenario: Org deny beats --trust-bin

- **WHEN** org policy denies the package (or deny_all) and install passes `--trust-bin`
- **THEN** the effective decision MUST remain deny/withhold for bin deploy
