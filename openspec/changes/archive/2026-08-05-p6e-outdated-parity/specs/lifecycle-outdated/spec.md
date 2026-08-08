## ADDED Requirements

### Requirement: Branch and literal pins use tip of resolved_ref

When a lock dependency has no semver `constraint`, outdated MUST compare `resolved_commit` (or equivalent current pin) to the tip of the pin identity in lock field `resolved_ref` via the injectable git-remote port (`resolveRef(url, resolved_ref)`). Defaulting every non-constraint pin to remote `HEAD` is FORBIDDEN when `resolved_ref` is a non-empty branch, tag, or other ref string. When `resolved_ref` is absent or empty on the lock entry, outdated MUST fall back to the manifest pin ref for the same dependency identity when discoverable; only when both lock and manifest lack a usable ref MAY the check use `HEAD`. Local deps (`local:` / empty remote) MUST be skipped without network and reported up-to-date (or equivalent skip). Registry/marketplace outdated pipelines are out of scope (unknown/skip OK).

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
