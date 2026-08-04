## ADDED Requirements

### Requirement: Gate uses discovery then extends resolve before evaluate
Full `install` (and gated `lock` / mutating `update`) MUST: discover the leaf policy via the ordered provider list (or explicit `--policy`); resolve and merge any `extends:` chain into an effective document; then evaluate that effective document. Blocking violations and `fetch_failure: block` fetch/parse failures MUST abort before durable modules/deploy writes.

#### Scenario: Extends parent deny blocks install
- **WHEN** leaf policy extends a parent that denies a planned dependency with effective `enforcement: block`
- **THEN** install MUST exit non-zero and MUST NOT create new modules/deploy artifacts for that proposed install

#### Scenario: Remote fetch_failure block aborts before writes
- **WHEN** remote or transitive extends fetch fails and effective `fetch_failure` is `block`
- **THEN** install MUST abort fail-closed before modules/deploy writes
