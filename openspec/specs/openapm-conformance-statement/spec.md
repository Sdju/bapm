# openapm-conformance-statement Specification

## Purpose

Publishes a verifiable OpenAPM v0.1 Mode B conformance claim for bapm: fixture-anchored tests, idempotent round-trip evidence, and a committed Consumer/Producer/(Governance floor) statement with Registry class N/A.

## Requirements

### Requirement: Seed fixtures are vendored in-repo

The repository MUST contain an OpenAPM v0.1 seed fixture tree equivalent to the normative layout in OpenAPM §12.4 (`manifest/`, `lockfile/`, `policy/`, `resolution/semver-dialect.json`, plus README), checked into git under a stable path such that CI and contributors can run Mode B without depending on `.samples/apm`.

#### Scenario: Fixture tree present for Mode B

- **WHEN** a contributor clones the repository without `.samples/apm`
- **THEN** the seed fixture paths cited by the conformance statement resolve inside the repository

### Requirement: Req-bound Mode B suite or checklist

bapm MUST maintain a TypeScript test suite and/or machine-checkable checklist that maps every `req-XXX` in each **claimed** conformance class to at least one assertion, citing the fixture path (when applicable) or the existing package test that exercises the requirement. Unclaimed classes and deferred requirements MUST be marked `skipped` or `N/A` with a written rationale—not silently omitted and not marked `active`/`pass`.

#### Scenario: Claimed requirement has a citation

- **WHEN** the published statement lists a requirement as `active` for a claimed class
- **THEN** the Mode B suite or checklist MUST include a fixture path and/or assertion reference for that `req-XXX`

#### Scenario: Deferred feature is not claimed pass

- **WHEN** a requirement is out of product scope (e.g. registry host rg-001, multi-host adapters, remote policy `extends`)
- **THEN** the statement MUST NOT list it as passing for a claimed class without a waiver/`skipped`/`N/A` rationale

### Requirement: Idempotent round-trip (req-cf-001)

A conforming Consumer claim MUST include an idempotent round-trip: re-parsing and re-serializing a conforming manifest and lockfile MUST yield a byte-equivalent second serialization (modulo trailing newline and YAML flow-style cosmetics the implementation is permitted to canonicalize), preserving unknown top-level keys and `x-*` extension entries.

#### Scenario: Manifest round-trip fixed point

- **WHEN** a conforming manifest fixture (including unknown/`x-*` fields) is parsed and serialized twice
- **THEN** the second serialization MUST be byte-equivalent to the first (within allowed cosmetics)

#### Scenario: Lockfile round-trip fixed point

- **WHEN** a conforming lockfile fixture (including unknown/`x-*` fields) is parsed and serialized twice
- **THEN** the second serialization MUST be byte-equivalent to the first (within allowed cosmetics)

### Requirement: Published conformance statement (req-cf-002)

bapm MUST publish a conformance statement at the repository root (`CONFORMANCE.md`, and a machine-readable `CONFORMANCE.json` when generated) identifying: claimed class(es), OpenAPM version `v0.1`, OPTIONAL features implemented, limitations/non-conformance points with rationale, and for each in-scope `req-XXX` the fixture path and assertion that exercises it.

#### Scenario: Statement lists claimed classes and version

- **WHEN** a reader opens the published conformance statement
- **THEN** it MUST state OpenAPM `v0.1` and which of Consumer, Producer, Governance, Registry are claimed, skipped, or N/A

#### Scenario: Per-requirement citation rows

- **WHEN** a requirement is in scope for a claimed class
- **THEN** the statement MUST list that `req-XXX` with fixture path and assertion citation (or an explicit skipped/waiver entry with rationale)

### Requirement: Claim posture honesty

The published claim MUST follow this posture unless a later change explicitly widens it:

- **Consumer** — claimed (primary), with waivers only where behavior is documented deferred or host-scoped (cursor-only deploy matrix).
- **Producer** — claimed for implemented emit/pack/init/`pr-004` surface.
- **Governance** — floor claim: local policy dual-read and install gate; remote providers and `extends` MUST be documented as not claimed / skipped (no silent full Governance claim).
- **Registry** — MUST be **N/A** (no registry host; no rg-001 claim). Consumer-side digest verification remains under Consumer requirements only.

#### Scenario: Registry class is N/A

- **WHEN** the statement is published
- **THEN** the Registry conformance class MUST be marked N/A and MUST NOT claim req-rg-001

#### Scenario: Governance floor documents remote/extends gap

- **WHEN** Governance is listed as claimed or floor
- **THEN** the statement MUST document that remote policy providers and `extends` are not claimed in this stage

### Requirement: Statement drift gate

CI or an equivalent repo-local check MUST fail when the committed conformance statement drifts from the Mode B suite/checklist coverage used to generate or validate it (regenerate-and-diff or equivalent).

#### Scenario: Drift fails the check

- **WHEN** a claimed requirement loses its only citation or the generated statement differs from the committed copy
- **THEN** the drift check MUST fail until the statement or suite is updated
