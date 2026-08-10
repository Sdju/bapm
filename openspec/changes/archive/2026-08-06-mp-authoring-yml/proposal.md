## Why

Marketplace track phase 5 (MUST floor) needs a truthful producer **authoring lifecycle** after consumer floors and thin `plugin init`. Authors cannot declare or mutate a `marketplace:` block in `bapm.yml`, nor run APM-like `init` / `package` / `check`, while pack host emit stays a later change. Without this floor, bapm cannot author marketplace package lists before `mp-pack-outputs`.

## What Changes

- Add core **authoring** schema/loader for top-level `marketplace:` in **`bapm.yml`** (strict unknown keys; inherit project `name`/`description`/`version`; parse/store `owner`, `build`, `outputs` without emitting host artifacts).
- Add `PackageEntry` + **req-mf-017** / APM `SOURCE_RE` source validation at parse/edit time (local `./…`, github shorthand, `host.tld/…`, `https://…`).
- Detect config source: `bapm.yml` block vs legacy `marketplace.yml`; both → hard error; none → actionable `init` hint.
- YAML editor: `package add|set|remove` with re-validate (atomic write preferred); optional default `git ls-remote` verify unless `--no-verify`.
- CLI authoring verbs under existing `bapm marketplace`: **`init`**, **`package` (add|set|remove)**, **`check`** (+ `--offline`); help splits Authoring vs Consumer.
- Online `check` v1: thin ambient GitHub `git ls-remote` for `owner/repo`; local schema-only; non-github remote → fail-soft warning / schema-only (document; no AuthResolver).
- Optional thin **`migrate`**: fold `marketplace.yml` → `bapm.yml` `marketplace:` (`--dry-run`, `--force`/`-y`) if cheap after schema/editor.
- Acceptance + unit under `**/mp-authoring-yml/`.

**Non-goals / deferred:** pack emit Claude/Codex marketplace.json (`mp-pack-outputs`); AuthResolver / gitlab / ado / GHES (`mp-hosts-auth`); `outdated` / `audit` as MUST; CONFORMANCE / `req-sc-*` claim-table churn; consumer `validate NAME` / search / install / find rework; `~/.bapm` registry layout changes; claiming pack marketplace mode as shipped.

## Capabilities

### New Capabilities

- `marketplace-authoring-schema`: Core authoring types (`MarketplaceConfig` / `PackageEntry`), loaders from `bapm.yml` / legacy `marketplace.yml`, config-source detect, source validators (mf-017), YAML package editor, init-block template fields (including parse/store of `outputs`/`build` without emit).
- `marketplace-cli-authoring`: FEOD CLI authoring surface on `bapm marketplace` — `init`, `package add|set|remove`, `check` (+ `--offline`), optional thin `migrate`; Authoring help section; thin github `ls-remote` for online check / add verify.

### Modified Capabilities

- `marketplace-cli-consumer`: Relax “authoring MUST NOT be registered”; keep consumer verbs unchanged; help MUST list Consumer and Authoring sections; `validate NAME` remains consumer-only as shipped.
- `cli-feod-architecture`: Extend existing `Marketplace` CLI module (services + public API) for authoring verbs; no new top-level command module; soft IoC / registry / help wiring only as needed.

## Impact

- `@b-apm/core`: new authoring submodule (or clearly separated API) under Marketplace / related — **do not** overload consumer `marketplace.json` models; public exports for load/detect/edit/validate/check helpers.
- `bapm` CLI: extend `modules/Marketplace` + `commands/marketplace`; Help Authoring section; `SUPPORTED_SUBCOMMANDS` / parse routes for new verbs.
- Tests: `tests/acceptance/mp-authoring-yml/` (+ unit under core/cli `**/mp-authoring-yml/`).
- Docs/design soft notes only; **no** CONFORMANCE.md claim-table edits; **no** pack emitters.
- Next after archive: `mp-pack-outputs` and/or SHOULD leftovers (`outdated` / `audit` / hosts-auth).
