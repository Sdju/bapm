# lifecycle-outdated Specification

## Purpose

Defines `bapm outdated` reporting of lock pins versus remote tips so operators can see drift without treating outdated rows as a CI failure gate.

## Requirements

### Requirement: Outdated compares lock pins to remote tips
Given a project lockfile, outdated MUST compare locked pins to remote tip / latest matching semver tag (for supported git kinds) and MUST report rows with status among `outdated`, `up-to-date`, and `unknown` (or equivalent documented labels).

#### Scenario: Up-to-date lock reports success
- **WHEN** lock pins match remote tips for all checked deps and outdated runs
- **THEN** output MUST indicate all up-to-date (or an equivalent success summary) and the exit code MUST be `0`

#### Scenario: Outdated row when tip ahead
- **WHEN** a branch or tag tip is ahead of the locked SHA/tag and outdated runs
- **THEN** output MUST include a row with status outdated showing current and latest identifiers

### Requirement: No lockfile yields non-zero
When no lockfile is discoverable via dual-read rules, outdated MUST exit non-zero with a clear error.

#### Scenario: Missing lock fails
- **WHEN** outdated runs in a project without `apm.lock.yaml` or `bapm.lock.yaml`
- **THEN** the exit code MUST be non-zero

### Requirement: Outdated exit policy mirrors APM (not CI gate)
When outdated packages are found, outdated MUST still exit `0` (warning/summary only). Continuous-integration fail-closed integrity MUST use `audit --ci`, not outdated exit status.

#### Scenario: Outdated found still exits zero
- **WHEN** at least one dependency row is outdated
- **THEN** the command MUST exit `0` after reporting those rows

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

### Requirement: No invented semver constraint from resolved_tag
When lock `constraint` is absent, outdated MUST NOT invent a semver range (including `^major.0.0` derived from `resolved_tag`) to force the tag-lister / highest-satisfying path. Entries with an explicit `constraint` MUST continue to use tag listing and highest-satisfying-tag selection. An entry with only `resolved_tag` / commit and no `constraint` MUST be treated as a tag or literal pin (tip or tag-equality path), not as a fabricated range.

#### Scenario: Tag without constraint is not a fake caret range
- **WHEN** a lock entry has `resolved_tag: v1.2.3` and `resolved_commit` but no `constraint`, and remote tags include a newer `v1.9.0` that would satisfy an invented `^1.0.0`
- **THEN** outdated MUST NOT report outdated solely because a higher major-compatible tag exists under that invented range

#### Scenario: Explicit constraint still detects newer tag
- **WHEN** a lock entry has `constraint: ^1.0.0`, `resolved_tag: v1.0.0`, and the tag lister returns a higher satisfying tag `v1.2.0`
- **THEN** outdated MUST report outdated with latest identifying that newer tag

### Requirement: Outdated is read-only
`outdated` MUST NOT write the lockfile, modules cache, project manifest, or target harness files. Optional temporary files outside the project tree (if any) MUST NOT leave the project tree bit-identical contract broken for lock/modules/manifest/targets.

#### Scenario: Project tree unchanged after outdated
- **WHEN** outdated runs successfully (with or without `-v`) against a fixture project
- **THEN** lockfile, `apm_modules/`, manifest, and target harness content under the project MUST be bit-identical to before the run

### Requirement: Verbose mode adds detail without mutating
When `-v` / `--verbose` is set, outdated MUST include richer human-readable detail (for example chosen tip ref, candidate tags, or skip reasons) while preserving default non-verbose row/summary stability enough for existing tests. Verbose mode MUST NOT change exit policy or write project artifacts.

#### Scenario: Verbose accepted and still exit zero on outdated
- **WHEN** at least one dependency is outdated and outdated runs with `-v` or `--verbose`
- **THEN** the command MUST exit `0`, MUST include additional detail beyond the default summary, and MUST NOT write the lockfile

### Requirement: Parallel remote checks preserve lock order
When checking remote dependencies, outdated MUST honor a concurrency bound `parallelChecks` (CLI default **4** when the flag is omitted). Value **`0` MUST run checks sequentially**. When `parallelChecks > 0` and more than one dependency requires a remote check, outdated MUST run those checks with concurrency ≤ `parallelChecks` (accepting the option while always remaining serial is FORBIDDEN). After concurrent completion, emitted `rows` and human/JSON report order MUST match lock dependency order. Local / non-network skips MAY complete without consuming a remote-check slot but MUST still appear in lock order among all rows. Tip-of-`resolved_ref`, constraint / no-invented-`^`, exit `0` with outdated rows, missing-lock non-zero, and read-only contracts MUST remain unchanged.

#### Scenario: Default concurrency is four
- **WHEN** outdated runs without an explicit parallel-checks value and at least two remote-checkable lock deps exist
- **THEN** remote checks MUST be eligible to run with concurrency up to **4** (not forced serial solely because the flag was omitted)

#### Scenario: Zero means serial
- **WHEN** outdated runs with `parallelChecks` / `--parallel-checks` / `-j` equal to `0` against multiple remote-checkable deps
- **THEN** remote checks MUST run sequentially (no overlapping in-flight remote checks)

#### Scenario: Positive bound is real concurrency
- **WHEN** outdated runs with `parallelChecks` = `2` (or CLI `-j 2`) against three or more injectable remote-check stubs that can observe overlap
- **THEN** at most two remote checks MUST be in flight at once, and at least one overlap MUST be possible (flag MUST NOT be a no-op serial path)

#### Scenario: Rows keep lock order after parallel checks
- **WHEN** multiple remote-checkable deps finish out of submission order under `parallelChecks > 0`
- **THEN** the resulting `rows` array and report MUST list dependencies in the same order as the lockfile dependencies list
