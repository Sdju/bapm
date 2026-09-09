## Purpose

Project-root `.bapmignore` gives authors gitignore-style control over which skill/package files are omitted from producer pack and registry publish archives, analogous to `.npmignore`.

## ADDED Requirements

### Requirement: Discover project-root .bapmignore

When packing or building a publish archive from a project tree, the system MUST look for a file named exactly `.bapmignore` at the project root (the same root used for dual-read manifest discovery). Absence of the file MUST be a no-op: collection behavior MUST match the pre-ignore baseline for that project. Nested `.bapmignore` files under subdirectories MUST NOT be read in v1. The system MUST NOT treat `.gitignore` as a substitute when `.bapmignore` is missing.

#### Scenario: Missing file leaves pack set unchanged

- **WHEN** pack or publish builds an archive for a conforming project with no `.bapmignore`
- **THEN** file membership MUST follow existing hard excludes and optional-docs rules without additional ignore filtering

#### Scenario: Nested ignore files are not loaded

- **WHEN** only `skills/foo/.bapmignore` exists and the project root has no `.bapmignore`
- **THEN** pack/publish MUST NOT apply patterns from that nested file

### Requirement: Gitignore-style pattern semantics

When `.bapmignore` is present, the system MUST parse it as a UTF-8 text file of gitignore-compatible patterns: `#` line comments, blank lines ignored, directory patterns, `*` / `**` / `?` wildcards, and `!` negation with last-matching-pattern wins. Paths matched for omission MUST be relative to the project root using `/` separators. A directory matched for ignore MUST exclude that directory and its descendants from the archive set. Malformed encoding or unreadable `.bapmignore` MUST fail closed (non-zero / thrown pack or publish error) without producing a successful archive.

#### Scenario: README pattern omits root README

- **WHEN** `.bapmignore` contains a pattern that matches `README.md` and the project has a root `README.md`
- **THEN** the resulting pack or publish archive MUST NOT contain `README.md`

#### Scenario: Negation re-includes a path

- **WHEN** `.bapmignore` contains `*.md` followed by `!LICENSE.md` and both `CHANGELOG.md` and `LICENSE.md` exist at the root
- **THEN** the archive MUST omit `CHANGELOG.md` and MUST still include `LICENSE.md` when that path is otherwise eligible for inclusion

#### Scenario: Unreadable ignore file fails closed

- **WHEN** `.bapmignore` exists at the project root but cannot be read as text for pattern loading
- **THEN** pack/publish MUST fail closed and MUST NOT emit a successful distributable archive

### Requirement: Always-include and always-omit paths

Ignore patterns MUST NOT strip the dual-read root manifest from a pack set: if a pattern matches `bapm.yml` or `apm.yml` at the project root, that manifest file MUST still be included when present. The file `.bapmignore` itself MUST NOT appear as an archive member. Hardcoded personal-omit basenames (`bapm.local.yml`, `bapm.local.lock.yaml`) and directory excludes (`.git`, `node_modules`) MUST remain omitted regardless of negation patterns in `.bapmignore`. Secret-pattern paths that survive ignore MUST still trigger fail-closed secret refuse; paths omitted by `.bapmignore` MUST NOT alone trigger secret refuse.

#### Scenario: Pattern cannot drop root manifest from pack

- **WHEN** `.bapmignore` contains `bapm.yml` (or `*` that would match it) and the project has a conforming root `bapm.yml`
- **THEN** the pack archive MUST still contain the root dual-read manifest

#### Scenario: .bapmignore is not shipped

- **WHEN** pack or publish builds an archive from a project that has `.bapmignore`
- **THEN** the archive MUST NOT contain a member named `.bapmignore`

#### Scenario: Ignored secret-named file does not refuse pack

- **WHEN** `.bapmignore` matches `.env` and a `.env` file exists at the project root
- **THEN** pack MUST succeed without secret-refuse solely due to that file, and the archive MUST NOT contain `.env`

### Requirement: Publish required .apm content remains fail-closed

When building a flat registry publish archive, ignore patterns MAY omit individual files under `.apm/`. After applying ignore, if the archive would lack a required `.apm/` tree with at least one packed file (or otherwise fail existing publish preflight for missing `.apm/`), publish MUST fail closed and MUST NOT upload. Wire root `apm.yml` for publish remains produced from the base manifest and MUST NOT be omitted via `.bapmignore`.

#### Scenario: Ignoring all of .apm fails publish

- **WHEN** `.bapmignore` matches every file under `.apm/` (for example `.apm/**`) on a project that otherwise has an on-disk `.apm/` directory
- **THEN** publish archive construction MUST fail closed and MUST NOT produce a successful upload archive

#### Scenario: Ignoring optional root docs still publishes

- **WHEN** `.bapmignore` lists `README.md` and `CHANGELOG.md` and `.apm/` still has packable files
- **THEN** the publish zip MUST omit those docs and MUST still contain wire `apm.yml` and remaining `.apm/` members
