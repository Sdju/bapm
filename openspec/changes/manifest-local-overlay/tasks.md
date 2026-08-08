## 1. Manifest local overlay core

- [x] 1.1 Add `BAPM_LOCAL_MANIFEST_FILE` / refuse `apm.local.yml`; discover optional overlay beside project root (no walk-up)
- [x] 1.2 Validate overlay allowlist (`active`, `target`, `targets`, `env`, `registries`) and field shapes; reject forbidden keys
- [x] 1.3 Implement merge helpers (active replace; env/registries deep-merge; target maps key-merge or field replace + mutual exclusion)
- [x] 1.4 Wire `loadEffectiveManifest` (or extend load) and export from Manifest public API / `publicApi`

## 2. Call-site effective document

- [x] 2.1 Route install / compile / object-map load / MCP bake paths through effective merged document
- [x] 2.2 Confirm `--target` still overrides effective `active`; unit tests for precedence and merge cases

## 3. Unpublished surfaces

- [x] 3.1 Exclude `bapm.local.yml` from pack `collectPackFiles` (omit, not secret-refuse)
- [x] 3.2 Exclude `bapm.local.yml` from publish archive construction
- [x] 3.3 Ensure/document gitignore pattern; doctor non-critical warning when file is git-tracked

## 4. Docs

- [x] 4.1 Document personal overlay in `apps/docs/guide/config-manifest.md` (allowlist, precedence, ≠ `local:` source)
- [x] 4.2 Add quick-start callout for `bapm.local.yml`; mention on conformance / OpenAPM boundary intentional diffs

## 5. Verify

- [x] 5.1 Run targeted unit/integration tests for overlay, pack omit, doctor warning
- [x] 5.2 `openspec validate manifest-local-overlay --strict`
