# find-reverse-index Specification

## Purpose

Defines offline reverse lookup of which locked package(s) own a deployed workspace path, built from lock inventory (`deployed_file_hashes` / `local_deployed_file_hashes` plus optional list fields), with APM-parity normalize/prefix lookup, owner labels, origin formatting, and why-chains.

## Requirements

### Requirement: Build reverse index from lock inventory
The system MUST build a reverse index from a loaded lock document that maps normalized deployed paths to an ordered list of owner keys. For each lock dependency, every path key in that dependency's `deployed_file_hashes` MUST map to that dependency's owner key. Every path key in document-level `local_deployed_file_hashes` MUST map to the workspace owner key `"."`. When `deployed_files` (per dependency) or `local_deployed_files` (document-level) are present, those path strings MUST be **unioned** into the same index with the same owners. Duplicate owners for the same path MUST be de-duplicated while preserving first-seen order. Owner encounter order MUST follow lock dependency array order, then local inventory. The index builder MUST NOT perform network I/O or mutate the lock or filesystem.

#### Scenario: Hash keys index to owners
- **WHEN** a lock dependency has `deployed_file_hashes` with path `AGENTS.md` and a hash value
- **THEN** the reverse index for `AGENTS.md` MUST include that dependency's owner key

#### Scenario: Local hashes map to workspace
- **WHEN** the lock document has `local_deployed_file_hashes` with path `notes/local.md`
- **THEN** the reverse index for that path MUST include owner `"."`

#### Scenario: List fields union with hashes
- **WHEN** a dependency has `deployed_files: ["shared/x.md"]` without that path in `deployed_file_hashes`
- **THEN** the reverse index for `shared/x.md` MUST still include that dependency's owner key

#### Scenario: Multi-owner preserves first-seen order
- **WHEN** two dependencies both record the same path and appear in lock dependency order A then B
- **THEN** lookup owners for that path MUST list A before B with no duplicate entries

### Requirement: Lookup with normalize and directory prefix
Given a query path and reverse index, lookup MUST normalize the query by converting `\` to `/`, stripping a leading `/`, and stripping a leading `./`. Lookup MUST return owners for an exact index key match when present. Otherwise, when an index key ends with `/` and the normalized query starts with that key, that key MUST be treated as a directory-prefix owner candidate; among matching directory prefixes the **longest** prefix MUST win. Lookup MAY also treat a query that itself behaves as a directory prefix over indexed entries consistently with APM find semantics. Lookup MUST NOT invent owners for paths absent from the index (empty owner list). Lookup MUST NOT require network access.

#### Scenario: Path normalize strips slash and dot-slash
- **WHEN** the index contains `skills/foo/SKILL.md` and the query is `/./skills/foo/SKILL.md` or uses backslashes
- **THEN** lookup MUST return the same owners as querying `skills/foo/SKILL.md`

#### Scenario: Longest trailing-slash directory prefix wins
- **WHEN** the index has owners for `skills/` and `skills/foo/` and the query is `skills/foo/bar.md`
- **THEN** lookup MUST attribute ownership using the longest matching `/`-suffix directory prefix (`skills/foo/`)

#### Scenario: Unknown path yields no owners
- **WHEN** the normalized query is not an exact or qualifying prefix match in the index
- **THEN** lookup MUST return an empty owner list (caller maps this to exit 1)

### Requirement: Owner labels and workspace sentinel
When rendering an owner for human stdout, the system MUST print `"."` for the workspace owner key. For a lock dependency owner, the label MUST be the dependency's `repo_url` when set and non-empty; otherwise the dependency's `name`. Label resolution MUST use the same lock identity already modeled for deps inspection (no second identity scheme).

#### Scenario: Prefer repo_url over name
- **WHEN** a matching dependency has both `repo_url: https://example.com/org/pkg.git` and `name: org/pkg`
- **THEN** the default owner line MUST be `https://example.com/org/pkg.git`

#### Scenario: Workspace prints dot
- **WHEN** lookup returns owner `"."`
- **THEN** the default owner line MUST be `.`

### Requirement: Source origin formatting
When source/origin detail is requested, each owner line MUST append a human origin string. For workspace owner `"."`, the formatted line MUST be `.  (workspace)`. For dependency owners, origin priority MUST be: OCI-style `resolved_url` beginning with `oci://` when present; else local `local_path` / local source path when present; else `repo@resolved_ref`; else `repo@resolved_tag`; else `repo@` + first 12 characters of resolved commit when present; else bare `repo_url` (or equivalent available lock fields). Origin formatting MUST use only lock fields (no network).

#### Scenario: Workspace source annotation
- **WHEN** source formatting is requested for owner `"."`
- **THEN** the line MUST be `.  (workspace)`

#### Scenario: Prefer resolved_ref over repo_url alone
- **WHEN** a dependency has `repo_url` and `resolved_ref` and source formatting is requested
- **THEN** the origin fragment MUST prefer `repo@resolved_ref` over bare `repo_url` alone when those fields are present

### Requirement: Path why-chains via offline why walker
When path/why detail is requested for a non-workspace owner, the system MUST print the package owner label on the first line and then indented dependency why-chain(s) computed offline via the existing lock-backed why walker (same graph as `deps why`). Root labels in chain text MUST use the project manifest convention (`bapm.yml` or the walker's existing text), not a hard-coded foreign `apm.yml` string. When why returns no chains, the system MUST fall back to printing the owner label alone. Workspace owner `"."` MUST NOT invoke why for marketplace/registry. Why MUST NOT perform network I/O.

#### Scenario: Path prints indented why chains
- **WHEN** path detail is requested for a locked dependency that has at least one why chain
- **THEN** stdout MUST include the owner label and at least one indented chain line derived from lock edges only

#### Scenario: Empty why falls back to label
- **WHEN** path detail is requested and the why walker yields no chains for that owner
- **THEN** stdout MUST still include the owner label and MUST NOT fail solely because why was empty

### Requirement: Offline find orchestration and exits
A core find entrypoint that loads the project lock, builds the reverse index, looks up the query path, and formats results MUST exit conceptually as: tracked path → success (exit 0); readable lock but unknown path → not found (exit 1); missing or unreadable lock → lock error (exit 2). Error messages for lock failure MUST mention the lockfile name (`bapm.lock.yaml`) and SHOULD tip the user to run install. Find MUST NOT write the lockfile, MUST NOT write deployed files, and MUST NOT call marketplace/registry/network clients.

#### Scenario: Tracked path is success
- **WHEN** find runs against a readable lock whose inventory contains the query path
- **THEN** the result MUST be success (exit 0) with owner line(s) on the success output channel

#### Scenario: Unknown path is exit one
- **WHEN** find runs against a readable lock that does not track the query path
- **THEN** the result MUST be not-found (exit 1) without inventing an owner

#### Scenario: Missing lock is exit two
- **WHEN** find runs in a project with no readable lockfile
- **THEN** the result MUST be lock-error (exit 2) with a message mentioning `bapm.lock.yaml`
