## ADDED Requirements

### Requirement: Implement-then-claim sc-003 sc-005 sc-013 sc-008

After shared PSL eTLD+1 ∪ aliases credential host-class, Registry redirect Auth drop, operator overlap precedence, ambient suppress on consumer git children, and non-https git-HTTP credential refuse (loopback / `insecure` exempt) ship with Mode B fixtures and/or assertion citations under `**/sc-host-class/` in the same change, Mode B MUST mark `req-sc-003`, `req-sc-005`, `req-sc-013`, and `req-sc-008` as `active` with non-empty citations that resolve on disk. Mode B MUST NOT mark those IDs `active` without the corresponding coverage for the full obligation text. Already-active `req-sc-001`, `req-sc-002`, `req-sc-006`, `req-sc-007`, `req-sc-009`, `req-sc-010`, `req-sc-011`, and `req-sc-012` MUST remain `active` with citations unchanged in intent. `req-sc-004` MUST remain `skipped` with soft zip / tar.gz-only rationale.

#### Scenario: sc-003 sc-005 sc-013 sc-008 active with citations

- **WHEN** the Mode B checklist is read after sc-host-class ships
- **THEN** `req-sc-003`, `req-sc-005`, `req-sc-013`, and `req-sc-008` MUST be `active` with non-empty citations whose paths resolve in-repo

#### Scenario: sc-004 stays skipped

- **WHEN** the Mode B checklist is read after sc-host-class ships
- **THEN** `req-sc-004` MUST remain `skipped`

#### Scenario: Prior soft-security and governance actives unchanged

- **WHEN** the Mode B checklist is read after sc-host-class ships
- **THEN** `req-sc-001`, `req-sc-002`, `req-sc-006`, `req-sc-007`, `req-sc-009`, `req-sc-010`, `req-sc-011`, and `req-sc-012` MUST remain `active` with non-empty citations

### Requirement: Limitations after host-class claims

Checklist `limitations` / `scope_out` and generated CONFORMANCE text MUST state that OpenAPM §10.3 credential host-class floor (PSL eTLD+1 ∪ aliases, redirect Auth drop, overlap precedence, ambient suppress, https-only git-HTTP attach refuse) is claimed for the consumer paths covered by Mode B citations. Residual Limitations MUST still name soft tar.gz-only container debt (sc-004) and any unported Auth depth (gh CLI / az bearer / credential-helper / `try_with_fallback` matrix) honestly. Limitations MUST NOT continue to describe full §10.3 host-class credential scoping as wholly deferred after this claim flip. Edits MUST go through checklist generator inputs; `conformance:gen` then `conformance:check` MUST pass.

#### Scenario: Host-class floor claimed in Limitations

- **WHEN** a reader opens published Limitations after regeneration
- **THEN** the text MUST acknowledge the claimed §10.3 host-class floor and MUST NOT frame it as wholly deferred

#### Scenario: Soft zip and residual Auth depth named

- **WHEN** a reader opens published Limitations after regeneration
- **THEN** the text MUST acknowledge soft zip / tar.gz-only debt and MUST name residual Auth depth not ported if applicable

#### Scenario: Drift gate green after claim flip

- **WHEN** checklist claim and Limitations edits are applied and the generator is run
- **THEN** committed `CONFORMANCE.md` and `CONFORMANCE.json` MUST match generator output and `conformance:check` MUST pass

## MODIFIED Requirements

### Requirement: Limitations after executable governance claims

Checklist `limitations` / `scope_out` and generated CONFORMANCE text MUST remove framing that interactive approve/deny UX is wholly out of scope for the claimed user-local surface. After sc-host-class, residual Limitations MUST name soft tar.gz-only container debt and residual Auth depth (if any), and MUST state MCP-only gate honesty for hooks/bin/canvas if not already clear — MUST NOT continue to list full §10.3 host-class credential scoping as deferred once `req-sc-003` / `005` / `013` / `008` are active. Edits MUST go through checklist generator inputs; `conformance:gen` then `conformance:check` MUST pass.

#### Scenario: Approve OOS removed for claimed surface

- **WHEN** a reader opens published Limitations after regeneration
- **THEN** the text MUST NOT list interactive approve/deny as an absolute out-of-scope blanket for the claimed sc-010 surface

#### Scenario: Host-class not wholly deferred after claim

- **WHEN** a reader opens published Limitations after sc-host-class regeneration
- **THEN** the text MUST NOT claim that full §10.3 host-class credential scoping remains wholly deferred

#### Scenario: Drift gate green after claim flip

- **WHEN** checklist claim and Limitations edits are applied and the generator is run
- **THEN** committed `CONFORMANCE.md` and `CONFORMANCE.json` MUST match generator output and `conformance:check` MUST pass

### Requirement: Limitations reflect soft zip container after caps

Checklist `limitations` / generated CONFORMANCE Limitations MUST state honestly that registry/pack archives remain zip with size/entry caps enforced, while OpenAPM tar.gz-only container format is soft / not claimed. After sc-host-class, Limitations MUST NOT state that full §10.3 host-class credential scoping remains deferred; they MUST reflect the claimed host-class floor and residual Auth depth honesty instead. Edits MUST go through checklist generator inputs; `conformance:gen` then `conformance:check` MUST pass.

#### Scenario: Soft zip named without claiming sc-004

- **WHEN** a reader opens published Limitations after regeneration
- **THEN** the text MUST acknowledge zip container soft debt (with caps) without claiming sc-004 active

#### Scenario: Drift gate green after claim flip

- **WHEN** checklist claim and Limitations edits are applied and the generator is run
- **THEN** committed `CONFORMANCE.md` and `CONFORMANCE.json` MUST match generator output and `conformance:check` MUST pass
