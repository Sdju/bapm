# local-path-source Specification

## Purpose

Defines the bapm-only `local` dependency source: default root `.agents/local`, optional custom path, path-equivalent resolve semantics, and fail-closed ensure that git does not track the effective local root.

## Requirements

### Requirement: Default local root is `.agents/local`

When an object APM dependency uses source discriminator `local` with no custom path value (`null`, omitted scalar after the key, empty string, or boolean `true`), the system MUST treat the effective package path as the project-relative directory `.agents/local` (equivalent to declaring `path: .agents/local` for resolution purposes).

#### Scenario: Bare local defaults to `.agents/local`

- **WHEN** a root `dependencies.apm` (or `devDependencies.apm`) entry is an object whose sole source discriminator is `local` with no custom path
- **THEN** resolve MUST use `.agents/local` under the project root as the local package path

#### Scenario: Boolean true local defaults

- **WHEN** the entry is `{ local: true }` with no other source discriminators
- **THEN** resolve MUST use `.agents/local` as the effective path

### Requirement: Custom local path overrides the default

When `local` is a non-empty string, the system MUST use that string as the effective local package path (same lexical project-root containment rules as ordinary `path:` local dependencies). Relative references on root declarations MUST resolve from the project root.

#### Scenario: Custom relative local path

- **WHEN** an entry is `{ local: ./vendor/my-skill }` (or another in-root relative string)
- **THEN** resolve MUST use that path as the local package path and MUST NOT force `.agents/local`

#### Scenario: Custom local path escaping root fails

- **WHEN** `local` names a path that normalizes outside the project root
- **THEN** resolution MUST fail with the same containment failure semantics as an escaping `path:` local dependency (`LOCAL_PATH_ESCAPES_PROJECT_ROOT` or equivalent) and MUST NOT materialize or write lock for that edge

### Requirement: Local source resolves as path-equivalent local kind

After expanding `local` to an effective path, the system MUST classify and resolve the dependency as `kind: local` using the same graph, modules materialization, and lock populate behavior as an equivalent OpenAPM `path:` local dependency. OpenAPM `path:` declarations MUST continue to work without requiring `local`.

#### Scenario: Local expands then resolves like path

- **WHEN** `{ local: ./pkgs/a }` points at a valid in-root package manifest
- **THEN** `resolveAndLock` / install resolve MUST succeed with a local lock identity consistent with path-local packages

#### Scenario: Path source remains unchanged

- **WHEN** a dependency uses only `path: ./pkgs/a` (no `local` key)
- **THEN** parse, classify, and resolve MUST behave as before this capability (no new gitignore ensure obligation for plain `path:`)

### Requirement: Ensure effective local root is not git-tracked

Before durable resolve/install success that consumes a `local` source, the system MUST ensure the effective local root directory is ignored by git for the project. When a project `.gitignore` (or equivalent documented ignore file the tool manages) lacks a pattern covering that root, the system MUST append a covering ignore rule. When the project is a git work tree and git already indexes one or more paths under the effective local root, the system MUST fail closed with actionable guidance (including untracking via `git rm --cached` and confirming the ignore rule) and MUST NOT report successful install/resolve for that operation.

#### Scenario: Missing ignore rule is appended

- **WHEN** resolve/install consumes `{ local: true }` (effective `.agents/local`) and the project `.gitignore` does not ignore that directory
- **THEN** the system MUST add a covering ignore entry for `.agents/local` (or the documented equivalent pattern) before succeeding

#### Scenario: Custom local root also ensured

- **WHEN** resolve/install consumes `{ local: ./alt-local }` and that root is not ignored
- **THEN** the system MUST ensure `./alt-local` (the effective root) is covered by gitignore before succeeding

#### Scenario: Already-tracked local root fails with guidance

- **WHEN** git already tracks files under the effective local root
- **THEN** the operation MUST fail closed with a diagnostic that names the local root and guides the user to stop tracking those paths (e.g. `git rm --cached`) and keep the ignore rule

#### Scenario: Plain path does not trigger local ensure

- **WHEN** only OpenAPM `path:` local deps are present (no `local` discriminator)
- **THEN** the system MUST NOT require the new local-root gitignore ensure as a condition of success solely because of those `path:` entries

### Requirement: Local is mutually exclusive with other source kinds

An object dependency MUST NOT combine `local` with `git`, `id`, `path`, `registry`, or `marketplace` as a second source kind. Meta fields such as `alias` MAY accompany `local`. The companion `path` used with `git` (virtual_path) MUST remain the OpenAPM `path` field — `local` MUST NOT replace that companion role.

#### Scenario: local and path together rejected

- **WHEN** an object dependency provides both `local` and `path` as source keys
- **THEN** parse/validate MUST reject the entry

#### Scenario: local with alias accepted

- **WHEN** an object dependency provides `local` plus `alias`
- **THEN** parse MUST accept and retain `alias`
