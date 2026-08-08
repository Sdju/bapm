## ADDED Requirements

### Requirement: Implement-then-claim sc-002 and sc-006

After archive-safe-extract and registries insecure http-gate ship with Mode B fixtures and/or assertion citations in the same change, Mode B MUST mark `req-sc-002` and `req-sc-006` as `active` with non-empty citations that resolve on disk. Mode B MUST NOT mark those IDs `active` without the corresponding code coverage (symlink reject + cleanup + caps for sc-002; `insecure` allowlist + http gate for sc-006). Already-active `req-sc-001`, `req-sc-007`, and `req-sc-009` MUST remain `active` with citations unchanged in intent. `req-sc-003`, `req-sc-005`, `req-sc-008`, `req-sc-010`, `req-sc-011`, `req-sc-012`, and `req-sc-013` MUST remain `skipped`. `req-sc-004` MUST remain `skipped` with an updated rationale stating that default size/entry caps are enforced on zip extract paths while OpenAPM tar.gz-only / reject-zip container format remains soft debt.

#### Scenario: sc-002 and sc-006 active with citations

- **WHEN** the Mode B checklist is read after sc-soft-security ships
- **THEN** `req-sc-002` and `req-sc-006` MUST be `active` with non-empty citations whose paths resolve in-repo

#### Scenario: sc-004 stays skipped with caps-on-zip rationale

- **WHEN** the Mode B checklist is read after sc-soft-security ships
- **THEN** `req-sc-004` MUST remain `skipped` and its rationale MUST mention caps on zip and soft container/format debt

#### Scenario: Deferred sc rows stay skipped

- **WHEN** the Mode B checklist is read after sc-soft-security ships
- **THEN** `req-sc-003`, `req-sc-005`, `req-sc-008`, `req-sc-010`, `req-sc-011`, `req-sc-012`, and `req-sc-013` MUST each remain `skipped`

#### Scenario: Prior actives unchanged

- **WHEN** the Mode B checklist is read after sc-soft-security ships
- **THEN** `req-sc-001`, `req-sc-007`, and `req-sc-009` MUST remain `active` with non-empty citations

### Requirement: Limitations reflect soft zip container after caps

Checklist `limitations` / generated CONFORMANCE Limitations MUST state honestly that registry/pack archives remain zip with size/entry caps enforced, while OpenAPM tar.gz-only container format is soft / not claimed, and that full §10.3 host-class credential scoping remains deferred. Edits MUST go through checklist generator inputs; `conformance:gen` then `conformance:check` MUST pass.

#### Scenario: Soft zip and deferred host-class named

- **WHEN** a reader opens published Limitations after regeneration
- **THEN** the text MUST acknowledge zip container soft debt (with caps) and deferred §10.3 / approve-deny gaps without claiming sc-004 active

#### Scenario: Drift gate green after claim flip

- **WHEN** checklist claim and Limitations edits are applied and the generator is run
- **THEN** committed `CONFORMANCE.md` and `CONFORMANCE.json` MUST match generator output and `conformance:check` MUST pass

## MODIFIED Requirements

### Requirement: Security req-sc honesty after marketplace floor

After the marketplace floor ships, Mode B MUST keep `req-sc-001`, `req-sc-007`, and `req-sc-009` as `active` with existing citations unchanged. Prior to implement-then-claim work, Mode B kept ten `req-sc-*` rows skipped with refined rationales. After `sc-soft-security`, Mode B MUST keep `req-sc-003`, `req-sc-004`, `req-sc-005`, `req-sc-008`, `req-sc-010`, `req-sc-011`, `req-sc-012`, and `req-sc-013` as `skipped` (sc-004 rationale refreshed for caps-on-zip / format soft). Each skipped row MUST carry a written rationale that names the real security-depth, soft-format, host-auth, or approve/deny gap — MUST NOT use a marketplace / plugin catch-all. Flipping any previously skipped `req-sc-*` to `active` MUST introduce Mode B fixture and/or assertion citations in the same change (as done for `req-sc-002` and `req-sc-006` under the implement-then-claim requirement).

#### Scenario: Already-active sc rows unchanged

- **WHEN** the Mode B checklist is read after this honesty pass
- **THEN** `req-sc-001`, `req-sc-007`, and `req-sc-009` MUST remain `active` with non-empty citations

#### Scenario: Residual skipped sc rows keep refined rationales

- **WHEN** the Mode B checklist is read after marketplace honesty and after sc-soft-security
- **THEN** remaining skipped `req-sc-*` rows MUST each be `skipped` and MUST NOT contain a marketplace/plugin catch-all rationale

#### Scenario: No false actives without citations

- **WHEN** a change completes without closing an sc-* implementation gap
- **THEN** that previously skipped `req-sc-*` MUST NOT be marked `active` without Mode B citations introduced in the same change
