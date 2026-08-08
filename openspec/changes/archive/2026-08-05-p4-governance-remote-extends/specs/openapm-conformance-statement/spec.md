## MODIFIED Requirements

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
