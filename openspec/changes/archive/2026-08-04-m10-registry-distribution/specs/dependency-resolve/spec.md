## MODIFIED Requirements

### Requirement: Classify dependency kinds per OpenAPM order

The system MUST classify each dependency declaration into one of: `local`, `registry`, `git-semver`, `git-literal` (and MAY recognize marketplace as non-normative). Classification MUST follow OpenAPM kind precedence: local → registry → git-semver → git-literal (req-rs-008). Git refs MUST be classified as semver range, literal, or none (req-rs-003).

#### Scenario: Local path kind

- **WHEN** a dependency uses `path:` / local-path form and has no `git:` / registry `id:`
- **THEN** the classified kind MUST be `local`

#### Scenario: Git-literal kind

- **WHEN** a dependency is `repo#main` or an object with a literal `ref:` (branch, tag name without semver range, or commit)
- **THEN** the classified kind MUST be `git-literal`

#### Scenario: Git-semver kind

- **WHEN** a dependency provides `ref:` as a node-semver range (for example `^1.2.0`)
- **THEN** the classified kind MUST be `git-semver`

#### Scenario: Registry kind uses registry fetch path

- **WHEN** a dependency provides registry `id:` (and registry coordinates)
- **THEN** the classified kind MUST be `registry`, and resolve/download MUST use the registry HTTP client path (see `registry-resolve-install`) and MUST NOT silently fall back to git; marketplace-kind deps MUST remain deferred/fail-closed

## ADDED Requirements

### Requirement: Registry resolve integrates with resolveAndLock

`resolveAndLock` and install resolve paths MUST support registry-sourced deps end-to-end when registries are configured: list → pick → download → lk-013 verify → materialize → lock populate. Git/local-only projects MUST remain unchanged in behavior.

#### Scenario: Registry dep resolves into modules and lock

- **WHEN** `resolveAndLock` runs on a project with a valid registries block and a registry dep against a mock registry
- **THEN** the package MUST appear under `apm_modules` and the lock MUST include registry `resolved_url` / `resolved_hash`

#### Scenario: Non-registry project unchanged

- **WHEN** `resolveAndLock` runs on a git/local-only project with no registry deps
- **THEN** behavior MUST match pre-M10 git/local resolve (no registry HTTP required)
