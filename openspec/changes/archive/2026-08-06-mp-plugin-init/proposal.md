## Why

Marketplace track phase 4 (SHOULD author) needs a thin producer entry point after consumer floors (registry / search-install / find). APM already ships `apm plugin init` as a minimal two-file scaffold; bapm has consumer `bapm init` only and explicitly skips plugin/marketplace scaffold. Authors cannot start a bapm plugin project without hand-writing `plugin.json` + plugin-mode `bapm.yml`.

## What Changes

- Add FEOD top-level group **`bapm plugin`** with subcommand **`init`** (noun-verb; not `bapm init --plugin`).
- Non-interactive **`--yes` / `-y`** path scaffolds **exactly** `plugin.json` + `bapm.yml` (thin scaffold only).
- Optional positional **`PROJECT_NAME`**: create subdirectory and write both files inside; name = argument when valid.
- Write **`plugin.json`** with APM-shaped fields (`name`, `version` `0.1.0` under `--yes`, `description`, `author: { name }`, `license: "MIT"`).
- Write **`bapm.yml`** in plugin mode: metadata + `dependencies.apm`/`mcp` + **`devDependencies.apm`**; consumer `bapm init` remains unchanged (no required `devDependencies`).
- Validate plugin id kebab-case (`^[a-z][a-z0-9-]{0,63}$`); reject path separators / `..` in `PROJECT_NAME` (SHOULD).
- Overwrite existing `bapm.yml` / `plugin.json` under `--yes` for **plugin init only** (APM-like); consumer `bapm init` keep refuse-overwrite.
- Optional `--target <id>` (single id, reuse Init pattern); optional `-v`/`--verbose` accepted.
- Help + registry wire `plugin`; unknown flags fail-closed; **no network**.

**Non-goals:** full authoring.yml suite (`marketplace init/migrate/package/check/outdated/audit`); pack/publish/XL producer; CONFORMANCE / `req-sc-*` churn; SKILL.md / empty `agents/`/`skills/` / start.prompt; expanding find/search/install/marketplace consumer; `bapm init --plugin` legacy alias; interactive wizard parity.

## Capabilities

### New Capabilities

- `cli-plugin-init`: Top-level FEOD `bapm plugin` group with `init` verb — argv/flags (`--yes`, optional `PROJECT_NAME`, `--target`, `-v`), help, exit codes, thin-scaffold orchestration, next-steps text hints (no pack impl).
- `plugin-scaffold`: Core helpers to validate plugin/project names, build/write `plugin.json`, and create plugin-mode minimal `bapm.yml` (`devDependencies.apm` present) without network or extra scaffold files.

### Modified Capabilities

- `cli-runtime-surface`: Register top-level `plugin`; help lists `plugin`.
- `cli-feod-architecture`: FEOD `Plugin` module + thin `commands/plugin` wiring (directory module, public `index.ts`, soft IoC via `app/init` / integrations; no module-local commands).

## Impact

- `@b-apm/core`: extend Manifest create/write helpers (plugin-mode option + `plugin.json` / name validation) or thin related helpers; public API export.
- `bapm` CLI: new `Plugin` FEOD module + `commands/plugin`; Help/registry/`COMMAND_PLUGIN`; `app/init/plugin`.
- Tests: acceptance under `tests/acceptance/mp-plugin-init/`; unit tests for name validate + writers.
- Docs/design soft note only; **no** CONFORMANCE.md / marketplace consumer / authoring-yml / pack output changes.
- Next after archive: product call for `mp-authoring-yml` / `mp-pack-outputs` (XL) **or** pause authoring track.
