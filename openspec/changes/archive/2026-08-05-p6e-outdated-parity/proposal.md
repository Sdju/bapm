## Why

After P6a–P6d, `update` is OpenAPM-relevant-parity, but `outdated` still mis-reports branch/literal pins by always comparing to remote `HEAD`, and fresh bapm locks omit APM’s pin-identity field `resolved_ref`. Operators cannot trust drift reports for non-default branches, and invented `^major` ranges from tags invent false semver drift. P6e closes this correctness + thin UX gap without reopening update, CONFORMANCE, or registry/marketplace outdated.

## What Changes

- Persist APM-compatible `resolved_ref` on lock write for git-literal and git-semver pins (tag-shaped: `resolved_ref` = picked tag when known)
- Change outdated branch/literal path to tip of lock `resolved_ref` (manifest pin fallback; `HEAD` only when ref truly absent)
- Stop inventing `^X.0.0` from `resolved_tag` when `constraint` is absent — treat as tag/literal pin
- Keep outdated read-only (no lock/modules/manifest/target writes) and exit `0` when outdated rows exist; missing lock → non-zero
- CLI: accept `-v` / `--verbose` for richer detail; unknown flags remain fail-closed
- SHOULD (if cheap): `--parallel-checks` / `-j`, stable `--json` rows — not blocking DoD
- **Out / non-goals:** `--global`, marketplace/registry outdated, full-SHA→annotated-tag suite, `deps clean`/`info`, update flag polish, multi-target, CONFORMANCE claim edits

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `lifecycle-outdated`: Tip-of-`resolved_ref` for non-constraint pins; no invented `^` from tag; read-only; verbose detail path
- `dependency-resolve`: Emit `resolved_ref` on resolve/lock for git pins without weakening `resolved_commit` / lk-015
- `lockfile-yaml-rw`: Treat `resolved_ref` as an accepted optional pin-identity field on load/serialize
- `cli-runtime-surface`: Register `-v` / `--verbose` on `outdated`; help notes report-only vs `update`

## Impact

- `packages/core`: Resolver `buildLockDocument` / graph pin fields; Outdated algorithm + types; Lockfile model if `resolved_ref` is first-class
- `packages/cli`: Outdated argv parse/help (`-v`); optional SHOULD flags
- Acceptance/unit tests: branch tip ≠ HEAD, semver path, no-`^` inference, missing lock, read-only tree, lock round-trip `resolved_ref`
- Knowledge/roadmap: P6e in flight; **no** CONFORMANCE.md claim-table edits; `update` behavior unchanged
