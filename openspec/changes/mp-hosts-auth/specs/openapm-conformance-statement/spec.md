## ADDED Requirements

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
