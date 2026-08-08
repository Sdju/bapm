## ADDED Requirements

### Requirement: Emit resolved_ref pin identity on git lock write

When `resolveAndLock` (or equivalent lock write after resolve) emits a git-literal or git-semver dependency entry, it MUST set APM-compatible `resolved_ref` to the concrete pin identity used for resolution: for git-literal, the classified ref string (branch name, tag name, or SHA as pinned; `HEAD` when the classification used default HEAD); for git-semver, the picked tag string when a tag is known (same value as `resolved_tag` when both are set). Emit MUST NOT drop `resolved_commit`, MUST NOT omit `tree_sha256` for git trees (lk-015), and MUST NOT weaken other OpenAPM lock requirements. Warm replay / update modes that rewrite git pins MUST keep emitting `resolved_ref` for newly written entries.

#### Scenario: Git-literal branch writes resolved_ref

- **WHEN** resolve succeeds for a dependency pinned to branch `feature/x`
- **THEN** the written lock entry MUST include `resolved_ref: feature/x` (or equivalent YAML) together with a 40-hex `resolved_commit`

#### Scenario: Git-semver writes resolved_ref equal to resolved_tag

- **WHEN** resolve succeeds for a git-semver dependency and picks tag `v1.2.0`
- **THEN** the written lock entry MUST include `resolved_tag: v1.2.0` and `resolved_ref` set to that same tag string, plus `constraint` and `resolved_commit`

#### Scenario: HEAD literal still records resolved_ref

- **WHEN** resolve succeeds for a git-literal dependency whose classified ref is absent or explicitly `HEAD`
- **THEN** the written lock entry MUST include `resolved_ref` of `HEAD` (or the documented default ref string used for resolve) with `resolved_commit`
