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

bapm MUST maintain a TypeScript test suite and/or machine-checkable checklist that maps every `req-XXX` in each **claimed** conformance class to at least one assertion, citing the fixture path (when applicable) or the existing package test that exercises the requirement. Unclaimed classes and deferred requirements MUST be marked `skipped` or `N/A` with a written rationale—not silently omitted and not marked `active`/`pass`. Rationales for deferred OpenAPM §10 security requirements (`req-sc-*`) MUST describe the actual security-depth, soft-format, host-auth, or approve/deny gap; marketplace floor shipping MUST NOT be used as a catch-all skip reason.

#### Scenario: Claimed requirement has a citation

- **WHEN** the published statement lists a requirement as `active` for a claimed class
- **THEN** the Mode B suite or checklist MUST include a fixture path and/or assertion reference for that `req-XXX`

#### Scenario: Deferred feature is not claimed pass

- **WHEN** a requirement is out of product scope (e.g. registry host rg-001, multi-host adapters, incomplete §10 security depth)
- **THEN** the statement MUST NOT list it as passing for a claimed class without a waiver/`skipped`/`N/A` rationale

#### Scenario: Skipped sc rationale is not marketplace catch-all

- **WHEN** a `req-sc-*` row is `skipped` after the marketplace floor
- **THEN** its rationale MUST name the security-depth or product-UX gap and MUST NOT claim marketplace/plugin deferral as the sole reason

### Requirement: Security req-sc honesty after marketplace floor

After the marketplace floor ships, Mode B MUST keep `req-sc-001`, `req-sc-007`, and `req-sc-009` as `active` with existing citations unchanged. Mode B MUST keep `req-sc-002`, `req-sc-003`, `req-sc-004`, `req-sc-005`, `req-sc-006`, `req-sc-008`, `req-sc-010`, `req-sc-011`, `req-sc-012`, and `req-sc-013` as `skipped`. Each skipped row MUST carry a written rationale that names the real security-depth, soft-format, host-auth, or approve/deny gap — MUST NOT use a marketplace / plugin catch-all (including the stale P3 phrase that marketplace/plugin/soft extras are deferred). This honesty pass MUST NOT flip any of those ten IDs to `active` without a Mode B fixture and/or assertion citation introduced in the same change.

#### Scenario: Already-active sc rows unchanged

- **WHEN** the Mode B checklist is read after this honesty pass
- **THEN** `req-sc-001`, `req-sc-007`, and `req-sc-009` MUST remain `active` with non-empty citations

#### Scenario: Ten sc rows stay skipped with refined rationales

- **WHEN** the Mode B checklist is read after this honesty pass
- **THEN** `req-sc-002`, `req-sc-003`, `req-sc-004`, `req-sc-005`, `req-sc-006`, `req-sc-008`, `req-sc-010`, `req-sc-011`, `req-sc-012`, and `req-sc-013` MUST each be `skipped` and MUST NOT contain a marketplace/plugin catch-all rationale

#### Scenario: Empty claim list for honesty floor

- **WHEN** this honesty pass completes without closing sc-* implementation gaps
- **THEN** no previously skipped `req-sc-*` MUST be marked `active`

### Requirement: Thin hosts-auth does not activate §10.3 sc claims
After the thin marketplace hosts+env expand ships, Mode B MUST keep `req-sc-003`, `req-sc-005`, `req-sc-008`, and `req-sc-013` as `skipped`. Rationales MAY be refined to state that product thin env host unlock shipped while full OpenAPM §10.3 credential classifier / redirect Auth drop / ambient suppress / overlap precedence across all consumer fetch/git paths is not claimed. This change MUST NOT mark those four IDs `active` without Mode B fixtures and citations that close the full obligation in the same change (Strategy A default: keep skipped). Already-active `req-sc-001`, `req-sc-007`, and `req-sc-009` MUST remain unchanged.

#### Scenario: sc-003 stays skipped after thin hosts
- **WHEN** the Mode B checklist is read after mp-hosts-auth ships without an implement-then-claim path
- **THEN** `req-sc-003` MUST remain `skipped`

#### Scenario: sc-005 stays skipped after thin hosts
- **WHEN** the Mode B checklist is read after mp-hosts-auth ships without an implement-then-claim path
- **THEN** `req-sc-005` MUST remain `skipped`

#### Scenario: sc-008 stays skipped after thin hosts
- **WHEN** the Mode B checklist is read after mp-hosts-auth ships without an implement-then-claim path
- **THEN** `req-sc-008` MUST remain `skipped`

#### Scenario: sc-013 stays skipped after thin hosts
- **WHEN** the Mode B checklist is read after mp-hosts-auth ships without an implement-then-claim path
- **THEN** `req-sc-013` MUST remain `skipped`

### Requirement: Limitations and scope-out reflect marketplace floor

Checklist `limitations` and `scope_out` (and the generated CONFORMANCE Limitations / Scope out / waivers text derived from them) MUST acknowledge that marketplace and plugin consumer/authoring surfaces exist as product floor. They MUST NOT list marketplace/plugin as an absolute out-of-scope blanket that explains residual `req-sc-*` skips. Residual Limitations/Scope-out MUST describe security-depth gaps (host-class credential scoping, approve/deny UX, soft archive format/caps, and related deferrals) honestly.

#### Scenario: Marketplace not absolute OOS for sc skips

- **WHEN** a reader opens published Limitations / Scope out after regeneration
- **THEN** the text MUST NOT claim marketplace/plugin surfaces are wholly out of scope as the reason for OpenAPM §10 `sc-*` deferrals

#### Scenario: Residual security gaps named

- **WHEN** a reader opens published Limitations / Scope out after regeneration
- **THEN** residual deferred security surfaces (at least host-class/auth follow-up and approve/deny UX, or equivalent accurate wording) MUST appear as limitations or scope-out items

### Requirement: Generator-only CONFORMANCE regeneration for sc honesty

Edits that change Limitations, Scope out, waivers, or per-`req-sc-*` status/rationale MUST be made in the Mode B checklist (or other generator inputs). Root `CONFORMANCE.md` and `CONFORMANCE.json` MUST be regenerated with the project generator (`conformance:gen` or equivalent). Hand-editing generated coverage tables or statement bodies MUST NOT be used to satisfy this change. After regeneration, `conformance:check` (or equivalent drift gate) MUST pass.

#### Scenario: Drift gate green after checklist honesty edits

- **WHEN** checklist honesty edits are applied and the generator is run
- **THEN** committed `CONFORMANCE.md` and `CONFORMANCE.json` MUST match generator output and the drift check MUST pass

#### Scenario: No hand-edit of generated statement

- **WHEN** apply updates sc-* honesty content
- **THEN** coverage rows and generated Limitations text MUST come from generator inputs, not from manual patches to `CONFORMANCE.md`/`CONFORMANCE.json` alone

### Requirement: Idempotent round-trip (req-cf-001)

A conforming Consumer claim MUST include an idempotent round-trip: re-parsing and re-serializing a conforming manifest and lockfile MUST yield a byte-equivalent second serialization (modulo trailing newline and YAML flow-style cosmetics the implementation is permitted to canonicalize), preserving unknown top-level keys and `x-*` extension entries.

#### Scenario: Manifest round-trip fixed point

- **WHEN** a conforming manifest fixture (including unknown/`x-*` fields) is parsed and serialized twice
- **THEN** the second serialization MUST be byte-equivalent to the first (within allowed cosmetics)

#### Scenario: Lockfile round-trip fixed point

- **WHEN** a conforming lockfile fixture (including unknown/`x-*` fields) is parsed and serialized twice
- **THEN** the second serialization MUST be byte-equivalent to the first (within allowed cosmetics)

### Requirement: Published conformance statement (req-cf-002)
bapm MUST publish a conformance statement at the repository root (`CONFORMANCE.md`, and a machine-readable `CONFORMANCE.json` when generated) identifying: claimed class(es), OpenAPM version `v0.1`, OPTIONAL features implemented, limitations/non-conformance points with rationale, and for each in-scope `req-XXX` the fixture path and assertion that exercises it. Regeneration MUST use the project generator (`conformance:gen` / equivalent); hand-edits that drift from generator input MUST fail `conformance:check`.

#### Scenario: Statement lists claimed classes and version
- **WHEN** a reader opens the published conformance statement
- **THEN** it MUST state OpenAPM `v0.1` and which of Consumer, Producer, Governance, Registry are claimed, skipped, or N/A

#### Scenario: Per-requirement citation rows
- **WHEN** a requirement is in scope for a claimed class
- **THEN** the statement MUST list that `req-XXX` with fixture path and assertion citation (or an explicit skipped/waiver entry with rationale)

#### Scenario: Governance class row is claimed not floor
- **WHEN** the statement summary lists Governance after P4
- **THEN** Governance MUST be marked claimed (not floor) with default discovery provider order documented

### Requirement: Claim posture honesty
The published claim MUST follow this posture unless a later change explicitly widens it:

- **Consumer** — claimed (primary), with waivers only where behavior is documented deferred or host-scoped (cursor-only deploy matrix).
- **Producer** — claimed for implemented emit/pack/init/`pr-004` surface.
- **Governance** — **claimed** when local dual-read, install gate, ordered providers including minimal `github-owner-dotgithub`, `extends` resolve (depth/cycle), host-class pin, §6.4 merge for gated families, pl-012 remote selection, and pl-010 fetch_failure:block on remote/`extends` failures are evidenced; pl-003/011/012 MUST be `active` with citations (not skipped as P4 deferred). Soft-active over-claims for pl-004/pl-006 without merge/host-pin MUST NOT remain.
- **Registry** — MUST be **N/A** (no registry host; no rg-001 claim). Consumer-side digest verification remains under Consumer requirements only.

#### Scenario: Registry class is N/A
- **WHEN** the statement is published
- **THEN** the Registry conformance class MUST be marked N/A and MUST NOT claim req-rg-001

#### Scenario: Governance claimed with remote and extends active
- **WHEN** Governance is listed as claimed after this change
- **THEN** the statement MUST mark req-pl-003, req-pl-011, and req-pl-012 as `active` with fixture/test citations and MUST NOT describe Governance as a local-only floor that defers remote/`extends`

### Requirement: Statement drift gate

CI or an equivalent repo-local check MUST fail when the committed conformance statement drifts from the Mode B suite/checklist coverage used to generate or validate it (regenerate-and-diff or equivalent).

#### Scenario: Drift fails the check

- **WHEN** a claimed requirement loses its only citation or the generated statement differs from the committed copy
- **THEN** the drift check MUST fail until the statement or suite is updated
