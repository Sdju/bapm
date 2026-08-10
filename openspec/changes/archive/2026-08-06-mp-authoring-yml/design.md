## Context

See proposal.md for motivation. Baseline: `bapm marketplace` is consumer-only (`add|list|browse|update|remove|validate`); `@b-apm/core` Marketplace owns consumer registry/`marketplace.json` models; Manifest parses dependency kind `marketplace` but not a top-level authoring `marketplace:` block; pack is plain zip; `plugin init` writes plugin-mode `bapm.yml` without `marketplace:`. Criteria lock D1–D9; deep-dive cuts XL APM surface to floor (schema + init + package CRUD + check). FEOD CLI profile locked: extend existing Marketplace module.

## Goals / Non-Goals

**Goals:**

- Separate authoring types/loaders/editor in core (not overloaded consumer JSON models).
- FEOD CLI: register authoring verbs on existing marketplace command; Authoring help section.
- Thin github ambient `git ls-remote` for online `check` and optional `package add` verify.
- Parse/store `outputs`/`build` for forward-compat; zero pack emit.
- Thin `migrate` in-slice if schema/editor land cleanly.
- Acceptance under `**/mp-authoring-yml/`.

**Non-Goals:**

- `mp-pack-outputs`, `mp-hosts-auth`, `outdated`/`audit` MUST, CONFORMANCE/`req-sc-*` claim churn, consumer validate/search/install/find rework, comment-preserving YAML as MUST.

## Decisions

### D1 — Authoring API lives in core Marketplace (fractal / adjacent files), separate types

- **Choice:** Add authoring config types (`MarketplaceAuthoringConfig` / `PackageEntry` or equivalent names) and loaders/editor/check helpers under `packages/core/src/modules/Marketplace/`, preferably a fractal submodule `modules/Authoring/` (or clearly named `authoring*.ts` files) with exports only via Marketplace `index.ts` → package public API. Do **not** reuse consumer `MarketplaceManifest` / `parseMarketplaceJson` for `bapm.yml` authoring.
- **Why:** Criteria G1; FEOD fractal OK; avoids model confusion.
- **Alternatives:** New top-level core `MarketplaceAuthoring` module — deferred unless size forces it; overloading consumer models — rejected.

### D2 — Manifest filename and YAML stack

- **Choice:** Authoring block only in **`bapm.yml`** (map APM `apm.yml`). Use existing shared YAML load helpers in `common`. Editor: load document → mutate `marketplace` mapping → dump; prefer atomic write. Comment preservation is SHOULD (S3) — document if round-trip drops comments; do not block floor on ruamel-equivalent.
- **Why:** Criteria D2 / G3.
- **Alternatives:** Dual-write `apm.yml` — OOS for this slice.

### D3 — Source validation = req-mf-017 / APM SOURCE_RE in code+tests

- **Choice:** Implement validators mirroring APM `SOURCE_RE` and OpenAPM req-mf-017 (a–d). Do **not** edit CONFORMANCE.md claim table or `req-sc-*` rows; existing mf-017 claim stays untouched.
- **Why:** Criteria D7 / MUST 3 / MUST NOT 3.
- **Alternatives:** Soft claim churn — rejected.

### D4 — Config detect parity with APM

- **Choice:** `detectAuthoringConfigSource(cwd)`: preferred block; legacy `marketplace.yml`; both → hard error; none → message pointing at `marketplace init`. Exit codes: prefer missing config ≈ 1, validation ≈ 2 when distinguishable.
- **Why:** Criteria MUST 4 / G2.

### D5 — Online check policy (resolves open question)

- **Choice:** Default-host github `owner/repo` → ambient `git ls-remote`. Local `./` → schema-only. Non-github remotes (`host.tld/…`, gitlab/ado HTTPS) → **fail-soft**: print clear “online check unsupported for this host; schema-only (use `--offline` to silence network attempts)” warning; schema failure still fails the command; unsupported host alone does **not** hard-fail if schema OK. No AuthResolver / PAT matrix.
- **Why:** Criteria D4 / G6 / open question — prefer warn over hard fail before `mp-hosts-auth`.
- **Alternatives:** Hard-fail non-github online — harsher, deferred; full AuthResolver — `mp-hosts-auth`.

### D6 — CLI surface under existing Marketplace (FEOD)

- **Choice:** Extend `SUPPORTED_SUBCOMMANDS` and `runMarketplace` routing: `init`, `package` (nested add/set/remove), `check`, optional `migrate`. Keep thin `commands/marketplace.ts`. Soft IoC via existing `app/init/marketplace` + integrations for new core APIs. Help: Consumer + Authoring sections.
- **Why:** Criteria G4; FEOD locked; proposal cli-feod delta.
- **Alternatives:** Top-level `bapm author` — rejected; nest under Plugin — wrong domain.

### D7 — Init template ~ APM render_marketplace_block

- **Choice:** Template includes `owner`, example package, `build.tagPattern`, `outputs.claude` (default map). `--force` overwrite; create stub `bapm.yml` if missing; `--name` / `--owner`. Text tip about generated marketplace.json gitignore MAY print; no emit.
- **Why:** Criteria MUST 5 / G5 / S4.

### D8 — Thin migrate in-slice (SHOULD → ship if cheap)

- **Choice:** Implement thin `migrate` after G1–G3 (fold legacy → block; `--dry-run`; `--force`/`-y`). If schedule slips, omit registration entirely (no stub). Prefer ship.
- **Why:** Criteria D8 / S1.
- **Alternatives:** Always defer — acceptable only if tasks explicitly skip with note.

### D9 — Pack emit deferred; outdated/audit deferred

- **Choice:** No writers under `.claude-plugin/` / Codex paths. No `outdated` / `audit` verbs in this change.
- **Why:** Criteria D3 / D9 / MUST NOT 1 / MUST NOT 5.

### D10 — package add verify default

- **Choice:** Default verify via `git ls-remote` for github shorthand unless `--no-verify` (SHOULD S5 / S4 gap). Non-github add: skip verify with warning or require `--no-verify` — align with D5 fail-soft.
- **Why:** APM parity for floor.

## Risks / Trade-offs

- [Consumer help/tests assert authoring absent] → Update consumer delta + fix `search-help` / marketplace tests that reject `init`/`package`/`check`.
- [YAML comment loss] → Document; optional later AST editor.
- [ls-remote flaky in CI] → Acceptance: `--offline` path MUST; online path mock or skip-if-no-git network in suite.
- [Authoring submodule size vs APM 1.3k schema] → Floor field set only; pass-through extras as opaque/optional maps where cheap.
- [Accidental CONFORMANCE edits] → Tasks forbid; review allowlist.

## Migration Plan

- Additive CLI verbs + core APIs; existing consumer registry unchanged.
- Legacy `marketplace.yml` users: warn on load; `migrate` when shipped.
- Rollback: remove authoring routes/exports; leave consumer verbs intact.

## Open Questions

None blocking. Deferred product: `mp-pack-outputs`, `mp-hosts-auth`, full `outdated`/`audit`, comment-preserving editor library choice if S3 revisited.
