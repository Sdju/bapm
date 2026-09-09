## ADDED Requirements

### Requirement: Implement-then-claim req-mf-024

After registry object-form identity preservation on serialize and structured rewrite ships with Mode B fixtures and/or assertion citations in the same change, Mode B MUST mark `req-mf-024` as `active` with non-empty citations that resolve on disk. Mode B MUST NOT mark `req-mf-024` active without coverage that a registry `id:` entry is not silently rewritten to `git:` form. Existing `req-mf-022` MUST remain `active`; its citations MUST include an assertion of the empty skill-subset diagnostic (not only generic manifest parse fixtures). Already-active neighboring mf rows MUST remain `active` with citations unchanged in intent.

#### Scenario: req-mf-024 active with citations

- **WHEN** the Mode B checklist is read after this change ships
- **THEN** `req-mf-024` MUST be `active` with non-empty citations whose paths resolve in-repo

#### Scenario: req-mf-022 cites empty-subset diagnostic

- **WHEN** the Mode B checklist is read after this change ships
- **THEN** `req-mf-022` MUST remain `active` and its citations MUST name a test that asserts the empty skill-subset match diagnostic

#### Scenario: Drift gate green after claim flip

- **WHEN** checklist claim edits are applied and the generator is run
- **THEN** committed `CONFORMANCE.md` and `CONFORMANCE.json` MUST match generator output and `conformance:check` MUST pass
