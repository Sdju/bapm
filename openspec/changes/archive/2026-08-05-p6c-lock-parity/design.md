## Context

See proposal.md — Why. Baseline: CLI `runLock` is flat (no `export`); `buildLockDocument` keeps per-dep `deployed_file_hashes` + `local_deployed_file_hashes` but drops `mcp_*` / other top-level bags; serialize would emit them if present; core download pool already coerces concurrency via `Math.max(1, n)` so CLI rejecting `0` is the gap; no SBOM module under `packages/*`. Criteria: `.samples/apm-knowledge/topics/p6c-lock-parity-criteria.md` + deep-dive. APM reference: `export/sbom.py`, `_preserve_existing_mcp_state`.

## Goals / Non-Goals

**Goals:**

- FEOD home for SBOM + thin CLI group routing.
- Opaque inventory carry on lock rewrite.
- Read-only deterministic export with APM-aligned formats and IO purity.
- Accept `--parallel-downloads 0` as serial.

**Non-Goals:**

- Design-level: no new download/license-authoring pipeline; no attestation; no `--global` / multi-target; no OpenAPM claim-table edits; no hard-reject of all bare-lock unknown flags as MUST (SHOULD only — prefer fail-closed on **export** path).

## Decisions

### D1 — Module placement: `packages/core/src/modules/Export` (not under Lockfile)

**Choice:** New FEOD module `Export` with public API `exportSbom` (and helpers: `buildPurl`, `scrubUrl`, format constants) re-exported from `app/publicApi.ts`.

**Rationale:** Lockfile remains YAML discover/parse/serialize/hash. SBOM is a distinct inventory serialization concern (CycloneDX/SPDX tables, purl). Matches APM’s separate `export/` package and sibling modules (`Audit`, `Deps`). Avoids bloating Lockfile with SPDX id tables.

**Alternative considered:** Nest under `Lockfile/export*` — rejected; mixes R/W lock model with report formats and invites deep imports of SPDX into lock hot paths.

**Lazy imports:** Prefer dynamic/`import()` for heavy SPDX license-id tables if they are large; keep CycloneDX/purl on the normal path if small.

### D2 — Carry-forward in `buildLockDocument`

**Choice:** After building `dependencies` + version + `generated_at` + existing local hash carry, shallow-copy from `existing` any present keys in a fixed allowlist plus remaining unknown/`x-*` top-level keys (excluding keys already set on the new document: `lockfile_version`, `dependencies`, `generated_at`).

**Allowlist (at least):** `mcp_servers`, `mcp_configs`, `mcp_target_servers`, `mcp_config_provenance`, `lsp_servers`, `lsp_configs`, `deployments`, plus any other keys already on `existing` that serialize’s knownOrder/unknown path would emit.

**Rules:** Opaque copy (no reshape). Do not invent bags from disk. Do not skip lk-015 `tree_sha256` for git entries.

**Alternative:** Full document merge then overwrite deps — riskier for stale dep fields; prefer explicit bag copy after fresh deps build (APM intent).

### D3 — CLI routing

**Choice:** In Lock module, if first arg is `export`, parse export-only flags and call core export; else existing bare-lock parse. Help lists both usages. Export path: fail-closed on unknown flags/format. Bare lock: keep soft-ignore of unknown flags for this change (SHOULD follow-up).

**IO:** SBOM → stdout unless `-o`; errors and `-o` success → stderr; missing lock → non-zero, empty stdout.

### D4 — Timestamp / determinism

**Order:** `--timestamp` → `SOURCE_DATE_EPOCH` → lock `generated_at` → fixed epoch (`1970-01-01T00:00:00Z` or APM-equivalent). Sort components by purl; `JSON.stringify` with stable key sort + indent 2 (or structured clone + sorted-key serializer). Branding in metadata: `bapm`.

### D5 — parallelDownloads 0

**Choice:** CLI parse accepts `n >= 0` (reject NaN / negative). Pass through; core `runPool` already serializes at `Math.max(1, concurrency)`. Align install help text if already documents `0` (P6a); lock help MUST document `0 = serial`.

### D6 — purl + scrub

Port APM `build_purl` / `scrub_url` semantics cheaply in TypeScript inside `Export` (no new npm SBOM libs required for P6c). License: passthrough `declared_license` three-state; no authoring nag.

## Risks / Trade-offs

| Risk                                      | Mitigation                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `mcp_servers` map vs APM list shape drift | Opaque carry; SBOM does not require MCP as components                        |
| SPDX table size on import                 | Lazy-load inside Export                                                      |
| Soft-ignored bare-lock typos              | Export fail-closed; bare hard-reject deferred                                |
| Branding ≠ APM goldens                    | bapm-owned fixtures only                                                     |
| Carry vs orphan prune                     | Only top-level bags + per-dep deployed hashes; deps still from resolve graph |

## Migration Plan

None for users. Existing locks with `mcp_*` start surviving bare `lock` after apply. No lockfile_version bump required for export.

## Open Questions

- None blocking — criteria open question on module path resolved as **Export** (D1). Hard-reject unknown bare-lock flags remains follow-up SHOULD.
