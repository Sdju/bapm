# policy-remote-discovery Specification

## Purpose

Provides pluggable ordered policy discovery with a minimal OpenAPM `github-owner-dotgithub` remote provider, pl-012 git remote selection, and fail-closed fetch_failure handling for remote and transitive extends loads.

## Requirements

### Requirement: Ordered selectable discovery providers

Discovery MUST expose a registered, ordered list of named providers (pl-011). The default order is implementation-defined and MUST be documented in the published conformance statement. Providers MUST be selectable per project via a policy `discovery:` block (or equivalent documented override). The implementation MUST NOT hard-code a host-specific discovery convention as the sole discovery path.

#### Scenario: Default list documented and includes local plus remote

- **WHEN** querying or documenting the default discovery provider order
- **THEN** the list MUST include the `local` dual-read provider and the `github-owner-dotgithub` provider in a documented order

#### Scenario: Discovery block selects providers

- **WHEN** a project policy (or config) selects a subset/order via `discovery:`
- **THEN** discovery MUST invoke only the selected providers in that order

### Requirement: Minimal github-owner-dotgithub remote provider

The implementation MUST ship the OpenAPM-named provider `github-owner-dotgithub`, which fetches `<owner>/.github/apm-policy.yml` from the same host as the project’s selected remote when that host matches the consumer’s implementation-default host. Full APM multi-candidate cascades (`.apm` / `_apm` / Azure DevOps surfaces) MUST NOT be required for Governance claim.

#### Scenario: Remote policy fetched from owner dotgithub

- **WHEN** `github-owner-dotgithub` is selected, the project remote is on the implementation-default host, and `<owner>/.github/apm-policy.yml` exists
- **THEN** discovery MUST yield that policy reference for load

#### Scenario: Non-default host skips remote provider without hard-coding sole path

- **WHEN** the project remote’s host does not match the implementation-default host
- **THEN** `github-owner-dotgithub` MUST NOT yield a policy solely by inventing a different host convention; discovery MAY continue to the next provider

### Requirement: Project remote selection for discovery

When identifying the project’s remote for discovery (pl-012), the implementation MUST: use the git remote named `origin` if present; if `origin` is absent and exactly one remote exists, use that remote; if multiple non-`origin` remotes exist, fail closed with a diagnostic naming candidates; if no remote exists, skip remote discovery (no remote provider yield).

#### Scenario: Origin preferred

- **WHEN** remotes include `origin` and others
- **THEN** discovery MUST use `origin` as the project remote

#### Scenario: Single non-origin remote used

- **WHEN** `origin` is absent and exactly one remote exists
- **THEN** discovery MUST use that remote

#### Scenario: Multiple non-origin remotes fail closed

- **WHEN** `origin` is absent and two or more remotes exist
- **THEN** remote discovery MUST fail closed with a diagnostic naming the candidates

#### Scenario: No remotes skips remote discovery

- **WHEN** the project has no git remotes
- **THEN** remote providers MUST NOT attempt fetch; local discovery MAY still apply

### Requirement: Fetch failure block on remote and transitive extends

When the effective `fetch_failure` value is `block` and a remote policy or a transitively `extends:`'d policy cannot be fetched or parsed, the install operation MUST abort with a fail-closed diagnostic (pl-010). Warn/off modes MUST NOT silently treat a failed remote/`extends` fetch as “no policy” when `fetch_failure` is `block` on the effective chain.

#### Scenario: Remote fetch fails with fetch_failure block

- **WHEN** a selected remote provider fails to fetch the policy and effective `fetch_failure` is `block`
- **THEN** the gate/install path MUST abort fail-closed before durable modules/deploy writes

#### Scenario: Transitive extends fetch fails with block

- **WHEN** a parent in an `extends:` chain fails to fetch/parse and effective `fetch_failure` is `block`
- **THEN** the load/gate path MUST abort with a fail-closed diagnostic
