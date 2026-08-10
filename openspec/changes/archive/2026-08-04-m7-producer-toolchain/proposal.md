## Why

M1–M6 delivered Consumer surface (manifest/lock dual-read, resolve, install, cursor, lifecycle/audit). bapm still cannot claim OpenAPM **Producer** for the subset that matters: conforming manifest emit (`init` + serialize), distributable archive pack with secret refusal, and git tag↔version awareness (**pr-004**). M7 closes that Producer floor without marketplace/plugin authoring or registry publish.

## What Changes

- **`@b-apm/core`:** producer emit helpers on Manifest (minimal scaffold + validate-before-write); new Pack module for plain-zip archive create/extract, sc-007 secret-path refusal, optional lock embed; release-check API comparing git tag (optional `v`) to manifest `version` (pr-004 MUST fail-closed; pr-005 unsigned advisory only)
- **`bapm` CLI (FEOD):** thin `init`, `pack` commands; round-trip via `install <archive-path>` (primary unpack equivalent); `pack --check-release` as pr-004 gate; help lists new surface; unknown flags hard-error
- **Defaults for gaps:** archive format = **plain zip** (not APM plugin format); pr-004 gate = **`bapm pack --check-release`** (optional `--tag`); default init write = **`bapm.yml`**; init target catalog thin to cursor / detect `.cursor/`
- **HARD:** packages `@b-apm/core` + CLI only; **MUST NOT** add new `bapm-target-*`
- **Non-goals:** `publish` → M10; `plugin` / marketplace / `--format plugin` / mf-017 → M9; Governance/policy → M8; auto tag create/push (OpenAPM forbids depending on it)

## Capabilities

### New Capabilities

- `producer-init`: Core + CLI `init` (`-y`) creates conforming default `bapm.yml`; refuse if `apm.yml` or `bapm.yml` already exists; dual-read discovery unchanged
- `producer-pack-archive`: Core + CLI `pack` builds plain zip (and/or dir) with conforming manifest; sc-007 refuse; `--dry-run`; round-trip via install-from-archive (or thin unpack extract)
- `producer-release-gate`: Core + CLI `pack --check-release` validates tag↔manifest `version` (pr-004 MUST); unsigned tag advisory only (pr-005 SHOULD)

### Modified Capabilities

- `manifest-yaml-validate`: Producer write/emit path MUST re-validate mf-* on serialize/init write (reuse parse); mf-004 advisory on non-semver write; preserve vendor `x-*`; never emit `workspaces`
- `cli-runtime-surface`: Register `init`, `pack`; help lists them + install-from-archive path; hard-error unknown flags
- `cli-feod-architecture`: Thin handlers + FEOD modules for Init/Pack; no business logic in `commands/` / `app/`
- `core-feod-architecture`: New/extended library modules (`Pack`, Init helpers on Manifest or dedicated module); no single-file modules; no core→cursor hard dep
- `install-pipeline`: Accept local pack archive path as install source (extract + consume conforming layout) for M7 round-trip
- `target-package-architecture`: Reaffirm M7 allow-list — only existing `bapm-target-api` + `bapm-target-cursor`; forbid new hosts

## Impact

- **`@b-apm/core`:** public symbols for create-minimal-manifest / validate-on-write, pack/unpack zip, secret patterns, checkReleaseTag; Manifest write hardened
- **`bapm` CLI:** `init`, `pack` commands + constants/registry/help; soft IoC via `app/init` + `app/integrations`
- **Install:** archive-path branch for round-trip without new target packages
- **Producer claim:** subset Producer (mf-001..003/005/014/015/021, ext-002, pr-004, sc-007); mf-017 N/A; publish/plugin absent by design
- **Out of scope this phase:** production/acceptance code authored here; git commit
