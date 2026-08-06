## ADDED Requirements

### Requirement: Implement-then-claim sc-010 sc-011 sc-012
After user-local interactive approve/deny, org executables deny-wins shared resolver (install≡audit), and lockfile-presence require + distinct withheld diagnostics ship with Mode B fixtures and/or assertion citations in the same change, Mode B MUST mark `req-sc-010`, `req-sc-011`, and `req-sc-012` as `active` with non-empty citations that resolve on disk. Mode B MUST NOT mark those IDs `active` without the corresponding coverage. Already-active `req-sc-001`, `req-sc-002`, `req-sc-006`, `req-sc-007`, and `req-sc-009` MUST remain `active` with citations unchanged in intent. `req-sc-003`, `req-sc-004`, `req-sc-005`, `req-sc-008`, and `req-sc-013` MUST remain `skipped`.

#### Scenario: sc-010 through sc-012 active with citations
- **WHEN** the Mode B checklist is read after sc-executable-governance ships
- **THEN** `req-sc-010`, `req-sc-011`, and `req-sc-012` MUST be `active` with non-empty citations whose paths resolve in-repo

#### Scenario: Host-class and soft skips unchanged
- **WHEN** the Mode B checklist is read after sc-executable-governance ships
- **THEN** `req-sc-003`, `req-sc-004`, `req-sc-005`, `req-sc-008`, and `req-sc-013` MUST each remain `skipped`

#### Scenario: Prior actives unchanged
- **WHEN** the Mode B checklist is read after sc-executable-governance ships
- **THEN** `req-sc-001`, `req-sc-002`, `req-sc-006`, `req-sc-007`, and `req-sc-009` MUST remain `active` with non-empty citations

### Requirement: Limitations after executable governance claims
Checklist `limitations` / `scope_out` and generated CONFORMANCE text MUST remove framing that interactive approve/deny UX is wholly out of scope for the claimed user-local surface. Residual Limitations MUST still name deferred host-class §10.3 gaps and soft tar.gz-only container debt, and MUST state MCP-only gate honesty for hooks/bin/canvas if not already clear. Edits MUST go through checklist generator inputs; `conformance:gen` then `conformance:check` MUST pass.

#### Scenario: Approve OOS removed for claimed surface
- **WHEN** a reader opens published Limitations after regeneration
- **THEN** the text MUST NOT list interactive approve/deny as an absolute out-of-scope blanket for the claimed sc-010 surface

#### Scenario: Host-class still deferred
- **WHEN** a reader opens published Limitations after regeneration
- **THEN** the text MUST still acknowledge deferred §10.3 host-class / AuthResolver gaps

#### Scenario: Drift gate green after claim flip
- **WHEN** checklist claim and Limitations edits are applied and the generator is run
- **THEN** committed `CONFORMANCE.md` and `CONFORMANCE.json` MUST match generator output and `conformance:check` MUST pass

## MODIFIED Requirements

### Requirement: Security req-sc honesty after marketplace floor
After the marketplace floor ships, Mode B MUST keep `req-sc-001`, `req-sc-007`, and `req-sc-009` as `active` with existing citations unchanged. After `sc-soft-security`, `req-sc-002` and `req-sc-006` MUST remain `active`. After `sc-executable-governance`, Mode B MUST keep `req-sc-003`, `req-sc-004`, `req-sc-005`, `req-sc-008`, and `req-sc-013` as `skipped` (sc-004 rationale remains caps-on-zip / format soft). `req-sc-010`, `req-sc-011`, and `req-sc-012` MUST be `active` with Mode B citations introduced in the same change. Each remaining skipped row MUST carry a written rationale that names the real security-depth, soft-format, or host-auth gap — MUST NOT use a marketplace / plugin catch-all. Flipping any previously skipped `req-sc-*` to `active` MUST introduce Mode B fixture and/or assertion citations in the same change.

#### Scenario: Already-active sc rows unchanged
- **WHEN** the Mode B checklist is read after this honesty pass
- **THEN** `req-sc-001`, `req-sc-002`, `req-sc-006`, `req-sc-007`, and `req-sc-009` MUST remain `active` with non-empty citations

#### Scenario: Residual skipped sc rows keep refined rationales
- **WHEN** the Mode B checklist is read after marketplace honesty, sc-soft-security, and sc-executable-governance
- **THEN** remaining skipped `req-sc-*` rows MUST each be `skipped` and MUST NOT contain a marketplace/plugin catch-all rationale

#### Scenario: No false actives without citations
- **WHEN** a change completes without closing an sc-* implementation gap
- **THEN** that previously skipped `req-sc-*` MUST NOT be marked `active` without Mode B citations introduced in the same change

### Requirement: Limitations and scope-out reflect marketplace floor
Checklist `limitations` and `scope_out` (and the generated CONFORMANCE Limitations / Scope out / waivers text derived from them) MUST acknowledge that marketplace and plugin consumer/authoring surfaces exist as product floor. They MUST NOT list marketplace/plugin as an absolute out-of-scope blanket that explains residual `req-sc-*` skips. Residual Limitations/Scope-out MUST describe remaining security-depth gaps (host-class credential scoping, soft archive format/caps, and related deferrals) honestly. After sc-executable-governance, interactive user-local approve/deny MUST NOT remain listed as an absolute OOS blanket for the claimed surface.

#### Scenario: Marketplace not absolute OOS for sc skips
- **WHEN** a reader opens published Limitations / Scope out after regeneration
- **THEN** the text MUST NOT claim marketplace/plugin surfaces are wholly out of scope as the reason for OpenAPM §10 `sc-*` deferrals

#### Scenario: Residual security gaps named
- **WHEN** a reader opens published Limitations / Scope out after regeneration
- **THEN** residual deferred security surfaces (at least host-class/auth follow-up and soft zip container vs tar.gz, or equivalent accurate wording) MUST appear as limitations or scope-out items without claiming interactive user-local approve as wholly OOS
