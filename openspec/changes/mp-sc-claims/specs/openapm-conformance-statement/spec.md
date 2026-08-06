## ADDED Requirements

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

## MODIFIED Requirements

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
