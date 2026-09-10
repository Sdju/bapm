## Why

APM 0.28 (#2454) makes `apm pack --check-versions` read `plugin.json` for local Plugin collections that have no `apm.yml`, while keeping the OpenAPM/APM YAML manifest authoritative when present. bapm already ships marketplace pack emit and `pack --check-release` (pr-004 tag↔manifest), but has **no** `--check-versions` gate — so plugin-only local packages cannot participate in marketplace version-alignment checks, and the deferred SHOULD from `mp-pack-outputs` remains open.

## What Changes

- Add `bapm pack --check-versions`: a release-time **marketplace version-alignment** gate over local-path packages (strategies `lockstep` / `tag_pattern` / `per_package`), distinct from existing `--check-release`.
- For each local package, resolve the declared version with precedence: dual-read OpenAPM manifest (`bapm.yml` / `apm.yml`) **authoritative when present**; only if neither exists, read `version` from `plugin.json` (standard plugin.json locations).
- **Fail closed** when the preferred manifest exists but is missing/invalid version (no silent `plugin.json` fallback), and when `plugin.json` is missing/malformed/oversized or has missing/non-printable `version`.
- When no `marketplace:` block is present, skip the gate with an informational message (APM parity) — do not invent a marketplace.
- Wire CLI flag + help; document in VitePress pack reference; unit/integration coverage for plugin-only, manifest-wins, and fail-closed cases.
- Gate-only mode MUST NOT write zip / marketplace.json solely because `--check-versions` ran (combine with `--archive` / marketplace emit only when those flags/intent apply as today).

### Non-goals (this change)

- `--check-clean` / marketplace drift gate.
- Machine `--json` pack envelope (APM Wave 4 SHOULD; not required for this slice).
- Changing `--check-release` / `--tag` semantics.
- `--format agent-plugin` rename; Copilot native (done); trust-bin; exclusive skills; deps subset; req-pl-018 / policy casing (next roadmap slice); Homebrew; `.bapmignore` churn.
- Doctor marketplace version-alignment rows (`doctor-basics` already forbids them).

### Follow-ups (not tasks of this change)

1. `policy-canonical-identity-casing` (last roadmap slice)
2. Optional later: `--check-clean`, pack `--json` envelope

## Capabilities

### New Capabilities

- `producer-pack-check-versions`: Marketplace version-alignment gate for `pack --check-versions`, including local package version source precedence (`bapm.yml`/`apm.yml` then `plugin.json`), strategy evaluation, skip-when-no-marketplace, and fail-closed errors.

### Modified Capabilities

- `producer-pack-archive`: Pack CLI surface MUST accept `--check-versions` (documented in help) without regressing `--archive` / `--check-release` / marketplace emit; gate remains orthogonal to M7 plain-zip success criteria.
- `marketplace-authoring-schema`: Formalize `marketplace.versioning.strategy` (`lockstep` | `tag_pattern` | `per_package`, default `lockstep`) enough for the gate to consume typed config (today passed through as `unknown`).

## Impact

- `@b-apm/core`: new Pack/Marketplace version-check helper + public export; Pack CLI options plumbing.
- `bapm` CLI: `parsePackArgs` / help / `runPack` gate-only path.
- Docs: `apps/docs/reference/pack.md` (+ brief producer/versioning note if needed).
- Tests: core unit tests mirroring APM `TestLocalVersionSource` + CLI/pack gate smoke; acceptance suite in later orch phases.
- No new workspace packages; no lockfile format bump.
