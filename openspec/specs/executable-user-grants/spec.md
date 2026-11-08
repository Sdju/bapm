# executable-user-grants Specification

## Purpose

Persists interactive executable approve/deny decisions in a user-local store under the bapm config root so grants are never auto-written into the project manifest (OpenAPM sc-010).

## Requirements

### Requirement: User-local executables store under config root

The system MUST load and save executable grants from a user-local JSON config file at `<config-root>/config.json` (default config root `~/.bapm`) under key `executables` with `allow` and `deny` maps. The config root MUST be injectable for tests. The store MUST NOT be treated as VCS-tracked project state by default.

#### Scenario: Save and reload user allow grant

- **WHEN** an interactive approve persists an MCP allow for package `mcp-dep` into the user config store
- **THEN** a subsequent load from the same config root MUST expose that package under `executables.allow`

#### Scenario: Injectable config root isolates tests

- **WHEN** callers supply an override config root directory
- **THEN** load/save MUST read and write `config.json` under that override and MUST NOT require the real `~/.bapm`

### Requirement: Interactive approve and deny CLI write user store only

The CLI MUST expose interactive `bapm approve` and `bapm deny` that persist decisions to the user-local executables store. Interactive defaults MUST target user scope only (always user-local, or require `--user`). Interactive approve/deny MUST NOT write approval or deny decisions into the project `bapm.yml` / `apm.yml` manifest. The commands MUST accept `--mcp` (default for compatibility), `--bin`, and `--hook` type flags; `bapm approve <pkg> --bin` MUST persist a `bin` allow grant so install does not require `--trust-bin` for that package. A user grant makes the grant surface present for trust evaluation but MUST NOT by itself require a decision for every unrelated package: packages unmentioned in project/user allow/deny are skipped with a non-fatal `MCP_NOT_APPROVED` warning (see executable-mcp-trust), while explicit deny remains fatal.

#### Scenario: Approve persists outside project manifest

- **WHEN** the user runs interactive `bapm approve` for a package in a project that has a `bapm.yml`
- **THEN** the user config store MUST gain the grant and the project manifest MUST remain unchanged for that decision

#### Scenario: One user grant does not decide unrelated packages

- **WHEN** the user store approves one package and a different dependency provides MCP without any allow/deny entry
- **THEN** install MUST NOT fail solely because of the unrelated grant; the unmentioned package MUST be skipped with `MCP_NOT_APPROVED`

#### Scenario: Deny persists outside project manifest

- **WHEN** the user runs interactive `bapm deny` for a package
- **THEN** the deny MUST be recorded in the user-local store and MUST NOT be written into project `bapm.yml`

#### Scenario: Help lists approve and deny

- **WHEN** top-level CLI help is rendered
- **THEN** `approve` and `deny` MUST be discoverable as registered commands
