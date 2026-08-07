# integration-vocabulary-hygiene Specification

## Purpose

Defines the active-documentation boundary for canonical integration terminology while protecting OpenAPM target-domain language and immutable migration history.

## Requirements

### Requirement: Active references use canonical specification slugs

Active documentation and active OpenSpec specifications MUST refer to `integration-package-architecture`, `integration-api-contracts`, and `integration-cursor-runtime` when describing the integration boundary. They MUST NOT point to the superseded active slugs `target-package-architecture`, `target-api-contracts`, or `target-cursor-minimal`.

#### Scenario: Maintainer follows an active integration reference

- **WHEN** a maintainer follows an active documentation or active-specification reference about the integration boundary
- **THEN** it resolves to a canonical integration specification rather than a superseded slug

### Requirement: Historical archive and negative migration evidence remain

The cleanup MUST NOT delete or rewrite historical OpenSpec archive entries. Negative assertions that retired `bapm-target-*` packages and compatibility surfaces are rejected MUST remain part of the supported migration evidence.

#### Scenario: Legacy package resolution remains rejected

- **WHEN** a consumer resolves a retired `bapm-target-*` package specifier after vocabulary cleanup
- **THEN** resolution fails while the canonical `bapm-integration-*` packages resolve normally

### Requirement: OpenAPM target-domain vocabulary is retained

Live documentation and command behavior MUST retain the OpenAPM manifest target field semantics and the `--target <id>` command-line option, even when the integration implementation and registry vocabulary is renamed.

#### Scenario: Manifest target selector remains accepted

- **WHEN** a user supplies a supported target id through the manifest or `--target <id>`
- **THEN** the application accepts it as the domain selector for a registered integration
