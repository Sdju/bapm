## ADDED Requirements

### Requirement: Doctor verbose enriches domain messages

When doctor runs with `verbose` enabled, each of the four project domains (git, manifest, lockfile, modules) MUST emit richer truthful detail than the compact default messages when applicable: git MUST include a version string from `git --version` (or a clear miss/timeout reason); manifest MUST include path and identity (`name`/`version`) when a readable manifest is present; lockfile MUST include path plus `lockfile_version` and/or dependency count when a readable lock is present; modules MUST include the modules path plus exists/entry-count or an explicit absent/ok indication. Absent manifest, lock, or modules directory MUST remain non-critical OK. Verbose mode MUST NOT change which checks are critical solely by being verbose. Default (non-verbose) output MUST remain a usable PASS/FAIL table and MUST NOT regress critical exit semantics (any `critical && !ok` → non-zero exit; all critical OK → exit `0`).

#### Scenario: Verbose enriches at least one domain on sane project

- **WHEN** doctor runs with verbose enabled in a sane project with git available
- **THEN** the exit code MUST be `0` if no critical failures remain, and output for at least one of git/manifest/lockfile/modules MUST include richer concrete detail than the corresponding non-verbose message (version string, path, identity, count, or explicit absent)

#### Scenario: Default doctor remains compact and critical-safe

- **WHEN** doctor runs without verbose on a sane project with git available
- **THEN** the exit code MUST be `0` if no critical failures remain, and output MUST still report PASS/FAIL lines for the four domains without requiring marketplace-style rows

### Requirement: Doctor excludes marketplace-style probe rows

Doctor MUST NOT emit marketplace config, format coverage, duplicate-name, version-alignment, or executable-trust check rows. Project-oriented domains remain git, manifest, lockfile, and modules (plus optional thin informational network/auth-env rows when shipped).

#### Scenario: No marketplace doctor rows

- **WHEN** doctor runs (default or verbose) on a typical project fixture
- **THEN** output MUST NOT include check names or rows for marketplace config, format coverage, duplicate names, version alignment, or executable trust

### Requirement: Doctor optional thin network and auth-env probes

Doctor MAY include a thin network probe via `git ls-remote` with a bounded timeout (for example ≤5s) and/or a thin auth-env informational check that reports whether a known token environment variable is set (for example `GITHUB_TOKEN` / `GH_TOKEN`) without printing secret values. When shipped, network MUST be informational or verbose-only (MUST NOT be critical solely for offline CI friendliness unless product later opts in), and auth-env MUST be informational and never critical. Missing token MUST NOT alone force a non-zero exit. Help MUST document network/auth only if those probes are shipped.

#### Scenario: Auth-env never fails exit alone

- **WHEN** doctor runs with auth-env probe shipped and no known token env is set, while git and other critical checks pass
- **THEN** the exit code MUST still be `0` and output MUST NOT print raw token/credential values

#### Scenario: Network probe does not critical-fail offline by default

- **WHEN** doctor runs with the thin network probe shipped and the probe fails or times out while critical project checks pass
- **THEN** the exit code MUST remain `0` (network informational or verbose-only), and output MAY report the network skip/fail reason

## MODIFIED Requirements

### Requirement: Doctor checks project artifact sanity

When a project directory is in scope, doctor MUST check that dual-read manifest and/or lock are readable if present (corrupt/unreadable MUST fail closed as critical or clearly reported). Doctor MUST check modules directory sanity (for example expected modules root exists or is creatable / not a blocking file). Deep marketplace authoring checks MUST NOT be required. Thin network and auth-env probes, when shipped, MUST follow the optional thin network and auth-env requirement (informational / verbose-only; never print secrets). Cursor detect MAY be informational only.

#### Scenario: Readable manifest and lock pass

- **WHEN** doctor runs in a project with valid dual-read manifest and lock
- **THEN** those artifact checks MUST pass (or report OK) provided git is also OK
