## ADDED Requirements

### Requirement: Registry resolves an unambiguous detected target

`bapm-target-api` MUST provide a registry operation that evaluates registered target detection for a project cwd and returns the detected registered targets. Detection failures from one target MUST be represented as diagnostics or a documented non-match, without activating that target. Consumers MUST be able to select a target by registered id without importing concrete target packages.

#### Scenario: Registry reports detected registered target

- **WHEN** a registry contains registered targets whose detection hooks are evaluated for a project cwd
- **THEN** consumers using only `bapm-target-api` MUST be able to identify every positively detected target id and select a registered target by id

### Requirement: Target contract supplies compile emission capability

`bapm-target-api` MUST define an optional host-agnostic compile emission capability through which a registered target receives the conflict-resolved primitive set and compile context, and reports the project-relative output path it would write or wrote. The compile context MUST preserve core-controlled validate and dry-run no-write semantics without requiring a concrete target to import core. A target without this capability MUST not be selected for compile.

#### Scenario: Registered compile-capable target receives primitives

- **WHEN** core invokes compile for a selected registered target that implements the compile emission capability
- **THEN** the target MUST receive the conflict-resolved primitives and MUST report its project-relative compile output path through the shared API contract

#### Scenario: Target without compile capability is not usable for compile

- **WHEN** a selected registered target lacks the compile emission capability
- **THEN** compile MUST fail with a clear capability error and MUST NOT fall back to a hard-coded host layout

### Requirement: Deployment reports retain target-owned attribution

Materialize and optional MCP configure reports exposed by `bapm-target-api` MUST identify the registered target responsible for each reported deployment inventory entry, including project-relative paths and available hashes. The contract MUST allow core to associate returned deployment entries with the primitive or MCP inventory supplied to that target, without core deriving a concrete target's layout or filenames.

#### Scenario: Core records target-reported deployment inventory

- **WHEN** a registered target materializes primitives or configures MCP and returns deployment inventory
- **THEN** core MUST be able to record the reported target-owned paths and hashes using only `bapm-target-api` contracts
