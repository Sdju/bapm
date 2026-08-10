## Context

See proposal.md for motivation. Baseline: consumer `bapm init` writes only `bapm.yml` and refuses overwrite when `bapm.yml`/`apm.yml` exist; registry has no `plugin` command. Core `createMinimalManifest` already scaffolds name/version/`dependencies.{apm,mcp}` and parse accepts `devDependencies`, but createMinimal does not emit `devDependencies`. APM `plugin init` delegates to `_perform_init(plugin=True)` writing `plugin.json` + plugin-mode `apm.yml` only (no SKILL.md / empty dirs). Criteria locks D1–D7; filename remains `bapm.yml`.

## Goals / Non-Goals

**Goals:**

- FEOD CLI `Plugin` module + thin `commands/plugin` + registry/help wiring.
- Core Manifest helpers: `validatePluginName`, `validateProjectName` (path-safe), `createPluginJson` / write, plugin-mode `createMinimalManifest` option emitting `devDependencies.apm`.
- Non-interactive `--yes` primary path; overwrite under `--yes` for plugin init only.
- Acceptance + unit tests covering MUST 1–10.

**Non-Goals:**

- Authoring.yml suite, pack outputs, CONFORMANCE claims, consumer find/search/install expansion, `bapm init --plugin` alias, interactive wizard parity, multi-value `--target` CSV in v1.

## Decisions

### D1 — CLI surface: `bapm plugin init` (FEOD Plugin module)

- **Choice:** Top-level `COMMAND_PLUGIN = "plugin"`; thin `commands/plugin.ts` → `modules/Plugin` (`createPlugin` + `run` with nested `init` verb). Soft IoC via `app/init/plugin.ts`; core APIs via `app/integrations`.
- **Why:** Criteria D4; FEOD locked profile (no module-local commands; directory module + public `index.ts`).
- **Alternatives:** `bapm init --plugin` (APM deprecated path) — OOS; nest under Marketplace — wrong domain.

### D2 — Scaffold helpers live in Manifest (not new core Plugin module)

- **Choice:** Add `validatePluginName`, project-name path checks, `createPluginJsonDocument` / `writePluginJson`, and `pluginMode?: boolean` (or `devDependencies`) on `createMinimalManifest` / write helpers inside `@b-apm/core` `Manifest`. Re-export from `app/publicApi`.
- **Why:** Thin slice; fields are producer metadata already owned by Manifest; avoids a one-purpose core Plugin module.
- **Alternatives:** New core `Plugin` module — deferred until pack/authoring needs grow.

### D3 — Thin files only; APM field parity

- **Choice:** Write exactly `plugin.json` + `bapm.yml`. `plugin.json`: name, version, description, `author: { name }`, `license: "MIT"`, indent 2 + trailing newline. Plugin-mode YAML: name/version/description/author; `dependencies: { apm: [], mcp: [] }`; `devDependencies: { apm: [] }`; prefer also `includes: auto` and `scripts: {}` for APM shape when cheap (MUST only requires deps + devDependencies.apm).
- **Why:** Criteria D2 / MUST 4–5 / APM helpers.

### D4 — Version under `--yes`: `0.1.0`

- **Choice:** Plugin init `--yes` defaults version to `0.1.0` for both files (APM plugin+yes override). Consumer `bapm init` unchanged.
- **Why:** Criteria MUST 4–5.

### D5 — Overwrite policy: APM-like for plugin init only

- **Choice:** Without `--yes`, refuse if `bapm.yml` already exists (and treat existing `plugin.json` consistently — refuse without `--yes`). With `--yes`, overwrite both. Do **not** change consumer `producer-init` refuse-overwrite.
- **Why:** Criteria open question resolved toward APM; keeps consumer init safe.

### D6 — `--target` single id; `-v` accepted

- **Choice:** Reuse Init single `--target <id>` → `target` or `targets` list with one entry. Accept `-v`/`--verbose` without requiring behavior beyond optional logs. No CSV multi-target in v1.
- **Why:** Criteria S1/S5; matches existing `bapm init`.

### D7 — No network / no CONFORMANCE

- **Choice:** Scaffold path is local FS only. Soft design note that this is producer soft entry, not claimed Producer floor / sc-* activation.
- **Why:** Criteria D6 / MUST 8 / MUST NOT 4–5.

### D8 — Next-steps text only

- **Choice:** On success, print hints mentioning `bapm pack` and install-dev style commands; no pack implementation.
- **Why:** Criteria S3 / APM next-steps.

## Risks / Trade-offs

- [Consumer vs plugin overwrite divergence] → Document in help; tests assert consumer init still refuses.
- [createMinimal pluginMode accidentally leaks into consumer init] → Keep option opt-in; consumer path does not pass pluginMode.
- [includes/scripts optional vs APM] → Prefer write them; acceptance MUST only asserts deps + devDependencies.apm.
- [Future authoring.yml] → New verbs later; keep `Plugin` module ready for nested verbs without shipping them now.

## Migration Plan

- Pure additive CLI + Manifest helpers; existing projects unaffected until users run `plugin init`.
- Rollback: remove Plugin command/module and Manifest plugin helpers; leave consumer init intact.

## Open Questions

None blocking. Deferred product: after archive, start XL `mp-authoring-yml` / `mp-pack-outputs` or pause authoring track.
