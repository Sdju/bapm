## ADDED Requirements

### Requirement: Full-SHA resolved_ref uses annotated-tag revision pin

When a lock dependency has no semver `constraint` and lock `resolved_ref` is a **full revision pin** (exactly 40 hexadecimal characters, case-insensitive), outdated MUST NOT treat tip-of-that-SHA (or any branch tip) as the sole “latest”. It MUST resolve latest as the commit behind the **highest non-prerelease annotated semver tag** for that remote, using APM-compatible tag name patterns (`v{version}`, `{name}--v{version}`, `{name}-v{version}`, and bare `{version}` fallback) with `{name}` derived from the package/repo basename (and virtual `path:` basename when applicable). Only tags with positive **annotated** evidence (peeled `refs/tags/…^{}` or equivalent injectable signal) are eligible; lightweight tags and branch names MUST NOT be selected as revision-pin targets. Compare the pin SHA to that tag’s commit SHA case-insensitively: equal → `up-to-date`; unequal → `outdated`. When no usable annotated semver candidate exists, or annotated evidence cannot be established (fail-closed), status MUST be `unknown` — never silently `up-to-date` via self-SHA tip resolve. Abbreviated SHAs (≠ 40 hex), branch names, tag names, and entries with an explicit `constraint` MUST remain on existing tip / constraint paths. Exit policy, read-only tree, parallel checks, and JSON row shape MUST stay unchanged; do NOT invent APM-only fields such as `source`.

#### Scenario: Full-SHA pin with newer annotated tag is outdated

- **WHEN** a lock entry has no `constraint`, `resolved_ref` is a 40-hex SHA, injectable annotated tags include a higher non-prerelease semver tag whose commit differs from that SHA, and outdated runs
- **THEN** that dependency MUST report status `outdated` with latest identifying the chosen tag (and MUST NOT report `up-to-date` solely because resolving the pin SHA returns itself)

#### Scenario: Full-SHA pin matching latest annotated tag commit is up-to-date

- **WHEN** a lock entry has no `constraint`, `resolved_ref` is a 40-hex SHA equal (case-insensitive) to the commit of the highest eligible annotated semver tag
- **THEN** outdated MUST report `up-to-date` for that dependency

#### Scenario: No annotated semver candidate yields unknown

- **WHEN** a lock entry is a full-SHA revision pin and the injectable tag set has no eligible annotated non-prerelease semver tag (empty, only prereleases, or only lightweight/branch-like names)
- **THEN** outdated MUST report `unknown` for that dependency (MUST NOT treat tip-of-pin-SHA as up-to-date)

#### Scenario: Lightweight tag cannot spoof annotated latest

- **WHEN** a full-SHA revision pin’s remote exposes a higher semver-looking **lightweight** tag (no annotated peel/evidence) and no higher annotated candidate
- **THEN** outdated MUST NOT select that lightweight tag as latest and MUST fail closed to `unknown` (or another non-spoofing outcome that does not treat the lightweight tag as the revision-pin tip)

#### Scenario: Abbreviated SHA stays on tip path

- **WHEN** a lock entry has no `constraint` and `resolved_ref` is an abbreviated hex SHA (length ≠ 40) whose tip resolve differs from a newer annotated tag commit
- **THEN** outdated MUST NOT enter the full-revision-pin annotated-tag path solely because the ref looks hex-like; existing tip-of-`resolved_ref` (or fallback) rules apply

#### Scenario: Constraint path unchanged beside SHA pins

- **WHEN** a lock entry has `constraint: ^1.0.0` and also a 40-hex `resolved_ref`
- **THEN** outdated MUST continue to use the constraint / highest-satisfying-tag path (revision-pin annotated-tag path MUST NOT replace constraint checks)

## MODIFIED Requirements

### Requirement: Branch and literal pins use tip of resolved_ref

When a lock dependency has no semver `constraint` and lock `resolved_ref` is **not** a full 40-hex revision pin, outdated MUST compare `resolved_commit` (or equivalent current pin) to the tip of the pin identity in lock field `resolved_ref` via the injectable git-remote port (`resolveRef(url, resolved_ref)`). Defaulting every non-constraint pin to remote `HEAD` is FORBIDDEN when `resolved_ref` is a non-empty branch, tag, or other non–full-SHA ref string. When `resolved_ref` is absent or empty on the lock entry, outdated MUST fall back to the manifest pin ref for the same dependency identity when discoverable; only when both lock and manifest lack a usable ref MAY the check use `HEAD`. Full 40-hex `resolved_ref` pins MUST follow the annotated-tag revision-pin requirement instead of tip-of-that-SHA. Local deps (`local:` / empty remote) MUST be skipped without network and reported up-to-date (or equivalent skip). Registry/marketplace outdated pipelines are out of scope (unknown/skip OK).

#### Scenario: Non-default branch tip is checked

- **WHEN** a lock entry has no `constraint`, `resolved_ref` is `feature/x`, and the injectable remote tip for `feature/x` differs from `resolved_commit` while `HEAD` tip equals `resolved_commit`
- **THEN** outdated MUST report that dependency as outdated against the `feature/x` tip (not treat it as up-to-date solely because `HEAD` matches)

#### Scenario: Default HEAD pin still works

- **WHEN** a lock entry has no `constraint` and `resolved_ref` is `HEAD` or the effective fallback ref is `HEAD`, and the remote `HEAD` tip matches `resolved_commit`
- **THEN** outdated MUST report up-to-date for that dependency

#### Scenario: Manifest fallback when lock omits resolved_ref

- **WHEN** a lock entry has no `constraint` and no `resolved_ref`, but the manifest pins the same identity to branch `release`, and the remote tip of `release` differs from `resolved_commit`
- **THEN** outdated MUST compare against tip of `release` (not unconditional `HEAD`)

#### Scenario: Local deps skip network

- **WHEN** a lock entry has empty `repo_url` or a `local:` identity
- **THEN** outdated MUST NOT call the git-remote or tag-lister ports for that entry and MUST NOT fail the command solely for that skip

#### Scenario: Full-SHA resolved_ref is not tip-of-SHA

- **WHEN** a lock entry has no `constraint` and `resolved_ref` is exactly 40 hex characters
- **THEN** outdated MUST NOT use tip-of-that-SHA as the revision-pin latest (annotated-tag path applies instead)
