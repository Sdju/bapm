## Why

Teams commit a shared `bapm.yml` / `apm.yml`, but individuals need personal overrides (`active` hosts, integration package maps, bake `env` defaults, registry auth-adjacent settings) that must not ship in git or pack artifacts. Today there is no first-class personal overlay file; stuffing those values into the shared manifest either leaks machine-local config or forces awkward per-developer branches.

## What Changes

- Discover optional **`bapm.local.yml`** beside the project manifest root (same directory as the dual-read base). Absence is OK; presence loads an allowlisted overlay.
- **v1 filename is only `bapm.local.yml`** — no `apm.local.yml`, and presence of `apm.local.yml` MUST fail closed (dual-conflict refuse) so branding stays unambiguous.
- Merge priority for effective settings: **CLI direct flags → `bapm.local.yml` → base `bapm.yml`/`apm.yml` → process env** (env only where an override already exists or is introduced for that setting).
- Overlay schema is an **allowlisted subset** (not a second full identity manifest): personal fields such as `active`, `target`/`targets`, `env`, and registries secrets-adjacent maps — with explicit per-field merge rules (replace vs deep-merge).
- Keep personal file unpublished: scaffold/ensure **gitignore**, **pack/publish exclude**, and **doctor warning** when the file is git-tracked.
- Document the personal local overlay in VitePress (`config-manifest` + quick-start).
- Do **not** conflate with dependency source `local` / `local:` path (existing capability).

### Non-goals

- Walk-up discovery of `bapm.local.yml` outside the project root.
- Writing secrets into git via local file guidance (local is for non-published personal config; prefer process env for real secrets).
- Changing dual-read base rules (exactly one of `bapm.yml` / `apm.yml`).
- Personal overlay of `name` / `version` / `dependencies` / `devDependencies` in v1.
- Auto-creating `bapm.local.yml` on init (gitignore entry / docs only unless apply chooses a stub example).

## Capabilities

### New Capabilities

- `manifest-local-overlay`: Optional `bapm.local.yml` discovery, allowlist validation, merge into effective manifest settings, unpublished guarantees (gitignore / pack exclude / doctor tracked warning), and docs obligations for the personal overlay.

### Modified Capabilities

- `manifest-active-targets`: Effective `active` (and related selection) MUST come from the merged overlay stack; document priority as flags → local → base → detect (env only if applicable). Forced `--target` still wins.
- `doctor-basics`: Warn (non-critical) when `bapm.local.yml` is present and git-tracked.
- `producer-pack-archive`: Default pack set MUST exclude `bapm.local.yml`.
- `producer-publish`: Publish/pack wire artifacts MUST NOT include `bapm.local.yml`.
- `docs-openapm-boundary`: Clarify `bapm.local.yml` is a bapm personal overlay (not OpenAPM-required; distinct from `local` dependency source).

## Impact

- `@bapm/core` Manifest discover/load/merge; constants for `bapm.local.yml`; callers that load effective project settings (install, compile, MCP bake, target map load)
- Pack/publish exclude lists; init or docs scaffold for `.gitignore`
- `bapm doctor` informational/warning check for tracked local overlay
- VitePress: `guide/config-manifest.md`, quick-start personal overlay section
- Acceptance: discovery optional, allowlist reject, merge precedence vs flags, pack exclude, doctor tracked warning
