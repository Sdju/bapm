## MODIFIED Requirements

### Requirement: Classify dependency kinds per OpenAPM order
The system MUST classify each dependency declaration into one of: `local`, `registry`, `git-semver`, `git-literal` (and MAY recognize marketplace as non-normative). Classification MUST follow OpenAPM kind precedence: local → registry → git-semver → git-literal (req-rs-008), except that an explicit marketplace string/object form MUST classify as `marketplace` before being mistaken for registry or git. Git refs MUST be classified as semver range, literal, or none (req-rs-003). A string beginning with `./`, `../`, `/`, `~/`, `.\\`, `..\\`, or `~\\`, and an object with a string `path` and no higher-precedence source discriminator, MUST classify as `local`; slash direction MUST NOT change this classification.

#### Scenario: Local path kind
- **WHEN** a dependency uses `path:` / local-path form and has no `git:` / registry `id:`
- **THEN** the classified kind MUST be `local`

#### Scenario: Explicit POSIX and Windows local prefixes classify as local
- **WHEN** a dependency string starts with any supported local prefix, including a backslash-delimited prefix
- **THEN** it MUST classify as `local` rather than registry, git, or marketplace

### Requirement: Resolve local dependencies within the project root
Local dependency resolution MUST convert backslash-delimited path syntax to POSIX segments before lexical normalization, resolve relative references from the declaring package directory, and permit a normalized target only when it remains within the root project's lexical path boundary. Root declarations use the project root as their declaring directory; each transitive local declaration uses the resolved parent package directory. Normalization MUST permit in-root dot-segment reduction such as `./a/../b` and transitive `../sibling` when the resulting target remains within the root. Absolute and home-prefixed references MUST be recognized as local and evaluated by the same containment rule; this requirement does not introduce a separate blanket prohibition for those forms.

#### Scenario: In-root normalization succeeds
- **WHEN** a root declaration references `./a/../b` and the normalized target is under the project root
- **THEN** the resolver MUST read and resolve package `b` as a local dependency

#### Scenario: Transitive sibling stays in root
- **WHEN** a local package declares `../sibling` relative to its own package directory and that sibling is under the project root
- **THEN** the resolver MUST include the sibling in the graph at the transitive depth

#### Scenario: Escape is refused before side effects
- **WHEN** a direct or transitive local reference normalizes outside the project root, including a backslash-delimited escape
- **THEN** resolution MUST fail with `LOCAL_PATH_ESCAPES_PROJECT_ROOT`, include the original reference in diagnostics, and perform no manifest read, downloader call, registry/git/marketplace fallback, policy evaluation, materialization, or lock write for that rejected edge

#### Scenario: Absolute and home forms are not classification bans
- **WHEN** an absolute or home-prefixed dependency reference is supplied
- **THEN** the resolver MUST classify it as local and apply project-root containment instead of rejecting it solely because of its prefix
